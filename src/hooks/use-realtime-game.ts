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

export function useRealtimeGame(gameId: string, initialState: GameState) {
  const supabase = createClient();
  const [game, setGame] = useState<GameState>(initialState);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawOffer, setDrawOffer] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to real-time updates
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
          setGame((prev) => ({ ...prev, ...updated } as GameState));
        }
      )
      .on("presence", { event: "sync" }, () => {
        setConnected(true);
      })
      .on("presence", { event: "join" }, () => {
        setConnected(true);
      })
      .on("broadcast", { event: "draw_offer" }, (payload) => {
        setDrawOffer("offer");
      })
      .on("broadcast", { event: "draw_declined" }, () => {
        setDrawOffer(null);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
          setError("Connection lost. Reconnecting...");
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase]);

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
            status: data.status || "timeout", // "timeout" (decisive loss) or "abort" (no-show, no rating hit)
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
        // Realtime will update the state, but we can also update immediately
        if (data.fen) {
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

  return { game, connected, error, drawOffer, makeMove, resign, checkTimeout, setGame, offerDraw, acceptDraw, declineDraw };
}
