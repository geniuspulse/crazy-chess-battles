"use client";

import { useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useRealtimeGame, type GameState } from "@/hooks/use-realtime-game";
import { Clock, Flag, Handshake } from "lucide-react";

interface GameClientProps {
  gameId: string;
  initialGame: GameState;
  currentUserId: string;
}

function formatClock(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return `0:${seconds.toString().padStart(2, "0")}`;
}

export default function GameClient({ gameId, initialGame, currentUserId }: GameClientProps) {
  const { game, connected, error, makeMove, resign } = useRealtimeGame(gameId, initialGame);
  const [chess] = useState(() => new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [clockTick, setClockTick] = useState(0);

  const isWhite = game.white_player_id === currentUserId;
  const isBlack = game.black_player_id === currentUserId;
  const myTurn = (isWhite && game.turn === "white") || (isBlack && game.turn === "black");
  const gameEnded = game.status !== "playing";

  // Live clock ticking
  useEffect(() => {
    if (gameEnded || !game.last_move_at) return;
    const interval = setInterval(() => {
      setClockTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameEnded, game.last_move_at]);

  // Calculate live clock display
  const getLiveClock = (player: "white" | "black") => {
    if (!game.last_move_at || !game.white_clock_ms || !game.black_clock_ms) return "—";
    if (gameEnded || game.turn !== player) {
      return formatClock(player === "white" ? game.white_clock_ms : game.black_clock_ms);
    }
    // Clock is ticking for the current player
    const elapsed = Date.now() - new Date(game.last_move_at).getTime();
    const baseMs = player === "white" ? game.white_clock_ms : game.black_clock_ms;
    return formatClock(Math.max(0, baseMs - elapsed));
  };

  // Sync local chess instance when game.fen changes from realtime
  useEffect(() => {
    setFen(game.fen);
    try {
      chess.load(game.fen);
    } catch {
      // FEN might be invalid during transitions
    }
  }, [game.fen, chess]);

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (!myTurn || gameEnded) return false;

      const success = makeMove(sourceSquare, targetSquare);
      return success;
    },
    [myTurn, gameEnded, makeMove]
  );

  const handleResign = async () => {
    await resign();
    setShowResignConfirm(false);
  };

  const myRatingChange = isWhite ? game.white_rating_change : game.black_rating_change;
  const opponentRatingChange = isWhite ? game.black_rating_change : game.white_rating_change;

  return (
    <div className="space-y-4">
      {/* Connection status */}
      {!connected && (
        <div className="rounded-lg bg-ccb-danger/10 border border-ccb-danger/30 text-ccb-danger px-4 py-2 text-sm text-center">
          Reconnecting to game...
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-ccb-danger/10 border border-ccb-danger/30 text-ccb-danger px-4 py-2 text-sm text-center">
          {error}
        </div>
      )}

      {/* Opponent info bar (top) */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center">
            <span className="text-lg">{isWhite ? "♚" : "♔"}</span>
          </div>
          <div>
            <div className="text-sm font-medium">
              {isWhite ? "Black" : "White"} (Opponent)
            </div>
            <div className="text-xs text-ccb-muted">
              {isWhite ? game.black_rating : game.white_rating}
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-lg font-bold ${
          game.turn === (isWhite ? "black" : "white") ? "bg-ccb-primary/10 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
        }`}>
          <Clock className="w-4 h-4" />
          {getLiveClock(isWhite ? "black" : "white")}
        </div>
      </div>

      {/* Chessboard */}
      <div className="w-full max-w-[600px] aspect-square mx-auto">
        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          boardWidth={600}
          arePiecesDraggable={myTurn && !gameEnded}
          customDarkSquareStyle={{ backgroundColor: "#312e81" }}
          customLightSquareStyle={{ backgroundColor: "#e0e7ff" }}
          customBoardStyle={{ borderRadius: "8px", overflow: "hidden" }}
        />
      </div>

      {/* My info bar (bottom) */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center">
            <span className="text-lg">{isWhite ? "♔" : "♚"}</span>
          </div>
          <div>
            <div className="text-sm font-medium">You ({isWhite ? "White" : "Black"})</div>
            <div className="text-xs text-ccb-muted">
              {isWhite ? game.white_rating : game.black_rating}
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-lg font-bold ${
          myTurn ? "bg-ccb-primary/10 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
        }`}>
          <Clock className="w-4 h-4" />
          {getLiveClock(isWhite ? "white" : "black")}
        </div>
      </div>

      {/* Game controls */}
      {!gameEnded && (
        <div className="flex items-center justify-center gap-3 max-w-[600px] mx-auto">
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

      {/* Game over banner */}
      {gameEnded && (
        <div className="card max-w-[600px] mx-auto text-center">
          <div className="text-4xl mb-2">
            {game.winner === (isWhite ? "white" : "black") ? "🎉" : game.winner === null ? "🤝" : "😞"}
          </div>
          <h3 className="text-xl font-bold capitalize mb-1">
            {game.status === "draw" ? "Draw" : game.status === "checkmate" ? "Checkmate" : game.status === "resign" ? "Resignation" : game.status === "timeout" ? "Time out" : game.status}
          </h3>
          <p className="text-sm text-ccb-muted mb-4">
            {game.winner === (isWhite ? "white" : "black")
              ? "You won!"
              : game.winner === null
              ? "Game drawn"
              : "You lost"}
          </p>
          {myRatingChange !== null && myRatingChange !== undefined && (
            <div className={`text-sm font-bold ${myRatingChange >= 0 ? "text-ccb-success" : "text-ccb-danger"}`}>
              {myRatingChange >= 0 ? "+" : ""}{myRatingChange} rating
            </div>
          )}
        </div>
      )}

      {/* Move count */}
      <div className="text-center text-xs text-ccb-muted">
        Move {game.move_count} · {game.time_control} · {game.rated ? "Ranked" : "Casual"}
      </div>
    </div>
  );
}
