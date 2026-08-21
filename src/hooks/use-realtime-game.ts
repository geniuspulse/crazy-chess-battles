"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface GameState {
  id: string;
  fen: string;
  pgn: string | null;
  turn: "white" | "black";
  status: string;
  winner: string | null;
  move_count: number;
  white_clock_ms: number | null;
  black_clock_ms: number | null;
  last_move_at: string | null;
  white_player_id: string;
  black_player_id: string;
  white_rating: number | null;
  black_rating: number | null;
  white_rating_change: number | null;
  black_rating_change: number | null;
  time_control: string;
  initial_minutes: number;
  increment_seconds: number;
  rated: boolean;
}

export interface MoveBroadcast {
  from: string;
  to: string;
  promotion?: string;
  fen: string;
  pgn: string;
  turn: "white" | "black";
  status: string;
  winner: string | null;
  moveCount: number;
  whiteClockMs: number | null;
  blackClockMs: number | null;
  lastMoveAt: string;
}

export function useRealtimeGame(gameId: string, initialState: GameState) {
  const supabase = createClient();
  const [game, setGame] = useState<GameState>(initialState);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawOffer, setDrawOffer] = useState<string | null>(null);
  const [opponentMove, setOpponentMove] = useState<MoveBroadcast | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Shared "last applied move" counter used by BOTH the postgres_changes
  // handler and the broadcast handler, so a delayed/out-of-order DB change
  // event can never clobber a newer state with an older FEN (this was
  // causing pieces to visually jump forward -> backward -> forward).
  const lastAppliedMoveCount = useRef<number>(initialState.move_count ?? 0);
  // Reconnection counter — bumping this re-triggers the subscription effect
  const [reconnectTick, setReconnectTick] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch the latest game state from the API as a fallback ──────────────
  // This runs:
  //   1. On initial mount (in case realtime hasn't connected yet)
  //   2. On every poll tick (every 4s — a safety net for missed realtime events)
  //   3. Immediately after any reconnection
  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/state?gameId=${gameId}`);
      if (!res.ok) return;
      const data = await res.json();

      // Only apply if this is a newer state than what we already have
      const newMoveCount = data.move_count ?? 0;
      if (newMoveCount < lastAppliedMoveCount.current) return;
      if (newMoveCount === lastAppliedMoveCount.current) {
        // Same move count — but check if status changed (e.g. timeout, resignation)
        if (data.status === game.status) return;
      }

      lastAppliedMoveCount.current = newMoveCount;
      setGame((prev) => ({
        ...prev,
        fen: data.fen ?? prev.fen,
        pgn: data.pgn ?? prev.pgn,
        turn: data.turn ?? prev.turn,
        status: data.status ?? prev.status,
        winner: data.winner ?? prev.winner,
        move_count: newMoveCount,
        white_clock_ms: data.white_clock_ms ?? prev.white_clock_ms,
        black_clock_ms: data.black_clock_ms ?? prev.black_clock_ms,
        last_move_at: data.last_move_at ?? prev.last_move_at,
      }));
    } catch {
      // Silent — polling will retry
    }
  }, [gameId, game.status]);

  // ── Subscribe to real-time updates ──────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<GameState>;
          // Ignore stale/out-of-order updates: only apply if this row
          // version is at least as new as the most recent move we've
          // already applied locally (covers replication lag / reordering).
          if (
            typeof updated.move_count === "number" &&
            updated.move_count < lastAppliedMoveCount.current
          ) {
            return;
          }
          if (typeof updated.move_count === "number") {
            lastAppliedMoveCount.current = updated.move_count;
          }
          setGame((prev) => ({ ...prev, ...updated } as GameState));
        }
      )
      .on("presence", { event: "sync" }, () => {
        setConnected(true);
      })
      .on("presence", { event: "join" }, () => {
        setConnected(true);
      })
      .on("broadcast", { event: "move" }, (payload: any) => {
        const data = payload.payload as MoveBroadcast;
        // Only process if this is a new move (avoid duplicate/stale processing)
        if (data.moveCount > lastAppliedMoveCount.current) {
          lastAppliedMoveCount.current = data.moveCount;
          setOpponentMove(data);
          // Also immediately update game state from the broadcast
          setGame((prev) => ({
            ...prev,
            fen: data.fen,
            pgn: data.pgn,
            turn: data.turn,
            status: data.status,
            winner: data.winner,
            move_count: data.moveCount,
            white_clock_ms: data.whiteClockMs,
            black_clock_ms: data.blackClockMs,
            last_move_at: data.lastMoveAt,
          }));
        }
      })
      .on("broadcast", { event: "draw_offer" }, () => {
        setDrawOffer("offer");
      })
      .on("broadcast", { event: "draw_declined" }, () => {
        setDrawOffer(null);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          setError(null);
          // On (re)connection, immediately fetch the latest state to catch
          // up on any moves we might have missed while disconnected.
          fetchGameState();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
          setError("Connection lost. Reconnecting...");
          // Auto-reconnect after 2 seconds by bumping the reconnect tick
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            setReconnectTick((t) => t + 1);
          }, 2000);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, supabase, reconnectTick]);

  // ── Polling fallback — fetch game state every 4 seconds ──────────────────
  // Realtime (both broadcast and postgres_changes) can silently drop on mobile
  // networks. This poll ensures we always catch opponent moves even if the
  // realtime channel is dead. It's a cheap single-row SELECT that short-circuits
  // when the move count hasn't changed.
  useEffect(() => {
    // Initial fetch in case realtime hasn't connected yet
    fetchGameState();

    pollRef.current = setInterval(() => {
      // Only poll while the game is still in progress
      setGame((prev) => {
        if (prev.status === "playing") {
          fetchGameState();
        }
        return prev;
      });
    }, 4000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchGameState]);

  // Check for timeout (server-side verification, client-callable)
  const checkTimeout = useCallback(async () => {
    try {
      const res = await fetch("/api/game/timeout-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.timedOut) {
          setGame((prev) => ({
            ...prev,
            status: data.status || "timeout",
            winner: data.winner,
          }));
        }
      }
    } catch {
      // Silent fail
    }
  }, [gameId]);


  const makeMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      try {
        const response = await fetch("/api/game/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId, move: { from, to, promotion: promotion || "q" } }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Move failed");
          return false;
        }

        setError(null);
        // Update local state immediately
        if (data.fen) {
          if (typeof data.moveCount === "number") {
            lastAppliedMoveCount.current = Math.max(lastAppliedMoveCount.current, data.moveCount);
          }
          setGame((prev) => ({
            ...prev,
            fen: data.fen,
            turn: data.turn,
            status: data.status,
            winner: data.winner,
            move_count: data.moveCount,
            white_clock_ms: data.whiteClockMs,
            black_clock_ms: data.blackClockMs,
            last_move_at: new Date().toISOString(),
          }));

          // Broadcast the move to the opponent over the realtime channel
          // This is faster than waiting for Supabase postgres_changes propagation
          if (channelRef.current) {
            const moveBroadcast: MoveBroadcast = {
              from,
              to,
              promotion: promotion || "q",
              fen: data.fen,
              pgn: data.pgn || "",
              turn: data.turn,
              status: data.status || "playing",
              winner: data.winner,
              moveCount: data.moveCount,
              whiteClockMs: data.whiteClockMs,
              blackClockMs: data.blackClockMs,
              lastMoveAt: new Date().toISOString(),
            };
            channelRef.current.send({
              type: "broadcast",
              event: "move",
              payload: moveBroadcast,
            });
          }
        }
        return true;
      } catch {
        setError("Network error");
        return false;
      }
    },
    [gameId]
  );

  // Resign the game
  const resign = useCallback(async () => {
    try {
      const response = await fetch("/api/game/resign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });

      const data = await response.json();
      if (response.ok) {
        setGame((prev) => ({
          ...prev,
          status: "resign",
          winner: data.winner,
        }));
      }
      return data;
    } catch {
      setError("Failed to resign");
      return null;
    }
  }, [gameId]);

  // Draw offer / accept / decline
  const offerDraw = useCallback(async () => {
    try {
      await fetch("/api/game/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, action: "offer" }),
      });
    } catch {}
  }, [gameId]);

  const acceptDraw = useCallback(async () => {
    try {
      const res = await fetch("/api/game/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, action: "accept" }),
      });
      const data = await res.json();
      if (res.ok) {
        setDrawOffer(null);
        setGame((prev) => ({ ...prev, status: "draw", winner: null }));
      }
    } catch {}
  }, [gameId]);

  const declineDraw = useCallback(async () => {
    try {
      await fetch("/api/game/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, action: "decline" }),
      });
    } catch {}
    setDrawOffer(null);
  }, [gameId]);

  return { game, connected, error, drawOffer, makeMove, resign, checkTimeout, setGame, offerDraw, acceptDraw, declineDraw, opponentMove };
}
