"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useRealtimeGame, type GameState } from "@/hooks/use-realtime-game";
import { Clock, Flag, Eye, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCapturedPieces, getCheckSquare } from "@/lib/game/board-helpers";
import MoveHistory from "./move-history";
import CapturedPieces from "./captured-pieces";
import VictoryOverlay, { type GameOutcome } from "./victory-overlay";

interface GameClientProps {
  gameId: string;
  initialGame: GameState;
  currentUserId: string;
  isSpectator?: boolean;
  whiteName?: string;
  blackName?: string;
}

const STATUS_LABELS: Record<string, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  draw: "Draw",
  resign: "Resignation",
  timeout: "Time out",
};

function formatClock(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return `0:${seconds.toString().padStart(2, "0")}`;
}

export default function GameClient({ gameId, initialGame, currentUserId, isSpectator = false, whiteName = "White", blackName = "Black" }: GameClientProps) {
  const { game, connected, error, drawOffer, makeMove, resign, checkTimeout } = useRealtimeGame(gameId, initialGame);
  const [chess] = useState(() => new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [opponentDrawOffer, setOpponentDrawOffer] = useState(false);
  const lastFenRef = useRef(game.fen);

  useEffect(() => {
    if (drawOffer === "offer") setOpponentDrawOffer(true);
    else if (drawOffer === null) setOpponentDrawOffer(false);
  }, [drawOffer]);

  const isWhite = game.white_player_id === currentUserId;
  const isBlack = game.black_player_id === currentUserId;
  const myTurn = (isWhite && game.turn === "white") || (isBlack && game.turn === "black");
  const gameEnded = game.status !== "playing";
  const myRatingChange = isWhite ? game.white_rating_change : game.black_rating_change;

  // Derived: captured pieces, check square, board highlights
  const captured = useMemo(() => getCapturedPieces(fen), [fen]);
  const checkSquare = useMemo(() => getCheckSquare(fen), [fen]);

  // Build move history from game PGN when FEN changes
  useEffect(() => {
    setFen(game.fen);
    lastFenRef.current = game.fen;
    try {
      const tempGame = new Chess(game.fen);
      // Reconstruct move history from the game's pgn if available
      if (game.pgn) {
        const pgnGame = new Chess();
        pgnGame.loadPgn(game.pgn);
        setMoveHistory(pgnGame.history());
        const verbose = pgnGame.history({ verbose: true });
        const last = verbose[verbose.length - 1];
        setLastMove(last ? { from: last.from, to: last.to } : null);
      } else {
        // Fallback: derive from move count
        setMoveHistory([]);
        setLastMove(null);
      }
    } catch {
      setMoveHistory([]);
      setLastMove(null);
    }
  }, [game.fen, game.pgn]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: "radial-gradient(circle, rgba(139,92,246,0.35) 70%, transparent 72%)" };
      styles[lastMove.to] = { background: "radial-gradient(circle, rgba(139,92,246,0.35) 70%, transparent 72%)" };
    }
    if (checkSquare) {
      styles[checkSquare] = {
        background: "radial-gradient(circle, rgba(239,68,68,0.6) 60%, transparent 62%)",
        boxShadow: "inset 0 0 12px rgba(239,68,68,0.5)",
      };
    }
    return styles;
  }, [lastMove, checkSquare]);

  const getLiveClock = (player: "white" | "black") => {
    if (!game.last_move_at || !game.white_clock_ms || !game.black_clock_ms) return "—";
    if (gameEnded || game.turn !== player) {
      return formatClock(player === "white" ? game.white_clock_ms : game.black_clock_ms);
    }
    const elapsed = Date.now() - new Date(game.last_move_at).getTime();
    const baseMs = player === "white" ? game.white_clock_ms : game.black_clock_ms;
    return formatClock(Math.max(0, baseMs - elapsed));
  };

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (isSpectator || !myTurn || gameEnded) return false;
      try {
        const tempGame = new Chess(fen);
        const move = tempGame.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        if (move === null) return false;
        setFen(tempGame.fen());
        setMoveHistory(tempGame.history());
        setLastMove({ from: sourceSquare, to: targetSquare });
      } catch {
        return false;
      }
      makeMove(sourceSquare, targetSquare);
      return true;
    },
    [isSpectator, myTurn, gameEnded, fen, makeMove]
  );

  const handleResign = async () => {
    await resign();
    setShowResignConfirm(false);
  };

  // ---- SPECTATOR VIEW ----
  if (isSpectator) {
    const topPlayer = { name: blackName, rating: game.black_rating, captured: captured.black, advantage: -captured.advantage, clock: getLiveClock("black"), isActive: game.turn === "black" && !gameEnded, symbol: "♚" };
    const bottomPlayer = { name: whiteName, rating: game.white_rating, captured: captured.white, advantage: captured.advantage, clock: getLiveClock("white"), isActive: game.turn === "white" && !gameEnded, symbol: "♔" };

    const board = (
      <div className="w-full">
        {!connected && (
          <div className="rounded-lg bg-ccb-surface border border-ccb-border text-ccb-muted px-4 py-2 text-sm text-center max-w-[600px] mx-auto mb-2">
            Connecting...
          </div>
        )}
        {/* Top player (Black) */}
        <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2 mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
              <span className="text-base">{topPlayer.symbol}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{topPlayer.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ccb-muted">{topPlayer.rating || "—"}</span>
                <CapturedPieces pieces={topPlayer.captured} advantage={topPlayer.advantage} perspective="top" />
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-lg font-bold transition-colors ${
            topPlayer.isActive ? "bg-ccb-primary/15 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
          }`}>
            <Clock className="w-4 h-4" />
            {topPlayer.clock}
          </div>
        </div>

        {/* Chessboard */}
        <div className="w-full max-w-[600px] aspect-square mx-auto">
          <Chessboard options={{
            position: fen,
            boardOrientation: "white",
            onPieceDrop: () => false,
            allowDragging: false,
            squareStyles: squareStyles,
            darkSquareStyle: { backgroundColor: "#312e81" },
            lightSquareStyle: { backgroundColor: "#e0e7ff" },
            boardStyle: { borderRadius: "8px", overflow: "hidden" },
          }} />
        </div>

        {/* Bottom player (White) */}
        <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2 mt-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
              <span className="text-base">{bottomPlayer.symbol}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{bottomPlayer.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ccb-muted">{bottomPlayer.rating || "—"}</span>
                <CapturedPieces pieces={bottomPlayer.captured} advantage={bottomPlayer.advantage} perspective="bottom" />
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-lg font-bold transition-colors ${
            bottomPlayer.isActive ? "bg-ccb-primary/15 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
          }`}>
            <Clock className="w-4 h-4" />
            {bottomPlayer.clock}
          </div>
        </div>
      </div>
    );

    const sidebar = (
      <div className="flex flex-col gap-3">
        <div className="card flex items-center justify-between">
          <Link href="/play" className="text-sm text-ccb-muted hover:text-ccb-primary flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2 text-sm text-ccb-muted">
            <Eye className="w-4 h-4" />
            <span>Spectating</span>
          </div>
        </div>
        <MoveHistory moves={moveHistory} />
        <div className="text-center text-xs text-ccb-muted">
          Move {game.move_count} · {game.time_control} · {game.rated ? "Ranked" : "Casual"}
        </div>
      </div>
    );

    return (
      <>
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start justify-center">
          <div className="w-full lg:w-[600px] shrink-0">{board}</div>
          <div className="w-full lg:w-[280px] shrink-0">{sidebar}</div>
        </div>
        <VictoryOverlay
          visible={gameEnded}
          outcome={(game.winner === null ? "draw" : "win") as GameOutcome}
          reasonLabel={STATUS_LABELS[game.status] || game.status}
          moveCount={game.move_count}
          subtitle={`${game.winner === "white" ? whiteName : game.winner === "black" ? blackName : "Draw"} · ${game.time_control}`}
          lobbyHref="/play"
        />
      </>
    );
  }

  // ---- PLAYER VIEW ----
  const opponentIsWhite = !isWhite;
  const opponentData = opponentIsWhite
    ? { name: whiteName, rating: game.white_rating, captured: captured.white, advantage: captured.advantage, clock: getLiveClock("white"), isActive: game.turn === "white" && !gameEnded, symbol: "♔" }
    : { name: blackName, rating: game.black_rating, captured: captured.black, advantage: -captured.advantage, clock: getLiveClock("black"), isActive: game.turn === "black" && !gameEnded, symbol: "♚" };
  const playerData = isWhite
    ? { name: "You", rating: game.white_rating, captured: captured.white, advantage: captured.advantage, clock: getLiveClock("white"), isActive: myTurn && !gameEnded, symbol: "♔" }
    : { name: "You", rating: game.black_rating, captured: captured.black, advantage: -captured.advantage, clock: getLiveClock("black"), isActive: myTurn && !gameEnded, symbol: "♚" };

  const board = (
    <div className="w-full">
      {!connected && (
        <div className="rounded-lg bg-ccb-danger/10 border border-ccb-danger/30 text-ccb-danger px-4 py-2 text-sm text-center max-w-[600px] mx-auto mb-2">
          Reconnecting to game...
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-ccb-danger/10 border border-ccb-danger/30 text-ccb-danger px-4 py-2 text-sm text-center max-w-[600px] mx-auto mb-2">
          {error}
        </div>
      )}

      {/* Opponent bar (top) */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2 mb-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
            <span className="text-base">{opponentData.symbol}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">{opponentData.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ccb-muted">{opponentData.rating || "—"}</span>
              <CapturedPieces pieces={opponentData.captured} advantage={opponentData.advantage} perspective="top" />
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-lg font-bold transition-colors ${
          opponentData.isActive ? "bg-ccb-primary/15 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
        }`}>
          <Clock className="w-4 h-4" />
          {opponentData.clock}
        </div>
      </div>

      {/* Chessboard */}
      <div className="w-full max-w-[600px] aspect-square mx-auto">
        <Chessboard options={{
          position: fen,
          boardOrientation: isWhite ? "white" : "black",
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            return onDrop(sourceSquare, targetSquare);
          },
          allowDragging: myTurn && !gameEnded,
          squareStyles: squareStyles,
          darkSquareStyle: { backgroundColor: "#312e81" },
          lightSquareStyle: { backgroundColor: "#e0e7ff" },
          boardStyle: { borderRadius: "8px", overflow: "hidden" },
        }} />
      </div>

      {/* My bar (bottom) */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2 mt-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
            <span className="text-base">{playerData.symbol}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">{playerData.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ccb-muted">{playerData.rating || "—"}</span>
              <CapturedPieces pieces={playerData.captured} advantage={playerData.advantage} perspective="bottom" />
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-lg font-bold transition-colors ${
          playerData.isActive ? "bg-ccb-primary/15 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
        }`}>
          <Clock className="w-4 h-4" />
          {playerData.clock}
        </div>
      </div>

      {/* Controls */}
      {!gameEnded && (
        <div className="flex items-center justify-center gap-3 max-w-[600px] mx-auto mt-3">
          {showResignConfirm ? (
            <>
              <span className="text-sm text-ccb-muted">Resign?</span>
              <button onClick={handleResign} className="btn bg-ccb-danger text-white px-4 py-2 text-sm">
                Yes, resign
              </button>
              <button onClick={() => setShowResignConfirm(false)} className="btn-secondary text-sm">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setShowResignConfirm(true)} className="btn-secondary text-sm">
              <Flag className="w-4 h-4 mr-1" /> Resign
            </button>
          )}
        </div>
      )}
    </div>
  );

  const sidebar = (
    <div className="flex flex-col gap-3">
      <div className="card flex items-center justify-between">
        <Link href="/play" className="text-sm text-ccb-muted hover:text-ccb-primary flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs text-ccb-muted">
          {game.time_control} · {game.rated ? "Ranked" : "Casual"}
        </div>
      </div>
      <MoveHistory moves={moveHistory} />
      <div className="text-center text-xs text-ccb-muted">
        Move {game.move_count} · {game.time_control}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start justify-center">
        <div className="w-full lg:w-[600px] shrink-0">{board}</div>
        <div className="w-full lg:w-[280px] shrink-0">{sidebar}</div>
      </div>
      <VictoryOverlay
        visible={gameEnded}
        outcome={(game.winner === null ? "draw" : game.winner === (isWhite ? "white" : "black") ? "win" : "loss") as GameOutcome}
        reasonLabel={STATUS_LABELS[game.status] || game.status}
        ratingChange={myRatingChange}
        moveCount={game.move_count}
        subtitle={`${game.time_control} · ${game.rated ? "Ranked" : "Casual"}`}
        lobbyHref="/play"
      />
    </>
  );
}
