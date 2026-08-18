"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useRealtimeGame, type GameState } from "@/hooks/use-realtime-game";
import { Clock, Flag, Eye, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface GameClientProps {
  gameId: string;
  initialGame: GameState;
  currentUserId: string;
  isSpectator?: boolean;
  whiteName?: string;
  blackName?: string;
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

export default function GameClient({ gameId, initialGame, currentUserId, isSpectator = false, whiteName = "White", blackName = "Black" }: GameClientProps) {
  const { game, connected, error, drawOffer, makeMove, resign, checkTimeout } = useRealtimeGame(gameId, initialGame);
  const [chess] = useState(() => new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [opponentDrawOffer, setOpponentDrawOffer] = useState(false);

  useEffect(() => {
    if (drawOffer === "offer") {
      setOpponentDrawOffer(true);
    } else if (drawOffer === null) {
      setOpponentDrawOffer(false);
    }
  }, [drawOffer]);
  const lastFenRef = useRef(game.fen);

  const isWhite = game.white_player_id === currentUserId;
  const isBlack = game.black_player_id === currentUserId;
  const myTurn = (isWhite && game.turn === "white") || (isBlack && game.turn === "black");
  const gameEnded = game.status !== "playing";

  const getLiveClock = (player: "white" | "black") => {
    if (!game.last_move_at || !game.white_clock_ms || !game.black_clock_ms) return "—";
    if (gameEnded || game.turn !== player) {
      return formatClock(player === "white" ? game.white_clock_ms : game.black_clock_ms);
    }
    const elapsed = Date.now() - new Date(game.last_move_at).getTime();
    const baseMs = player === "white" ? game.white_clock_ms : game.black_clock_ms;
    return formatClock(Math.max(0, baseMs - elapsed));
  };

  useEffect(() => {
    setFen(game.fen);
    lastFenRef.current = game.fen;
    try {
      chess.load(game.fen);
    } catch {}
  }, [game.fen, chess]);

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (isSpectator || !myTurn || gameEnded) return false;
      try {
        const tempGame = new Chess(fen);
        const move = tempGame.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        if (move === null) return false;
        setFen(tempGame.fen());
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

  const myRatingChange = isWhite ? game.white_rating_change : game.black_rating_change;

  // Spectator view
  if (isSpectator) {
    return (
      <div className="space-y-4">
        {/* Spectator banner */}
        <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2">
          <Link href="/play" className="text-sm text-ccb-muted hover:text-ccb-primary flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2 text-sm text-ccb-muted">
            <Eye className="w-4 h-4" />
            <span>Spectating</span>
          </div>
        </div>

        {!connected && (
          <div className="rounded-lg bg-ccb-surface border border-ccb-border text-ccb-muted px-4 py-2 text-sm text-center max-w-[600px] mx-auto">
            Connecting...
          </div>
        )}

        {/* Top player (Black) */}
        <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center">
              <span className="text-lg">♚</span>
            </div>
            <div>
              <div className="text-sm font-medium">{blackName}</div>
              <div className="text-xs text-ccb-muted">{game.black_rating || "—"}</div>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-lg font-bold ${
            game.turn === "black" && !gameEnded ? "bg-ccb-primary/10 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
          }`}>
            <Clock className="w-4 h-4" />
            {getLiveClock("black")}
          </div>
        </div>

        {/* Chessboard */}
        <div className="w-full max-w-[600px] aspect-square mx-auto">
          <Chessboard options={{
            position: fen,
            boardOrientation: "white",
            onPieceDrop: () => false,
            allowDragging: false,
            darkSquareStyle: { backgroundColor: "#312e81" },
            lightSquareStyle: { backgroundColor: "#e0e7ff" },
            boardStyle: { borderRadius: "8px", overflow: "hidden" },
          }} />
        </div>

        {/* Bottom player (White) */}
        <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center">
              <span className="text-lg">♔</span>
            </div>
            <div>
              <div className="text-sm font-medium">{whiteName}</div>
              <div className="text-xs text-ccb-muted">{game.white_rating || "—"}</div>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-lg font-bold ${
            game.turn === "white" && !gameEnded ? "bg-ccb-primary/10 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
          }`}>
            <Clock className="w-4 h-4" />
            {getLiveClock("white")}
          </div>
        </div>

        {/* Game over banner */}
        {gameEnded && (
          <div className="card max-w-[600px] mx-auto text-center">
            <div className="text-4xl mb-2">
              {game.winner === "white" ? "♔" : game.winner === "black" ? "♚" : "🤝"}
            </div>
            <h3 className="text-xl font-bold capitalize mb-1">
              {game.status === "draw" ? "Draw" : game.status === "checkmate" ? "Checkmate" : game.status === "resign" ? "Resignation" : game.status === "timeout" ? "Timeout" : game.status}
            </h3>
            <p className="text-sm text-ccb-muted">
              {game.winner === "white" ? `${whiteName} wins` : game.winner === "black" ? `${blackName} wins` : "Draw"}
            </p>
          </div>
        )}

        <div className="text-center text-xs text-ccb-muted">
          Move {game.move_count} · {game.time_control} · {game.rated ? "Ranked" : "Casual"}
        </div>
      </div>
    );
  }

  // Player view (existing logic)
  return (
    <div className="space-y-4">
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
          game.turn === (isWhite ? "black" : "white") && !gameEnded ? "bg-ccb-primary/10 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
        }`}>
          <Clock className="w-4 h-4" />
          {getLiveClock(isWhite ? "black" : "white")}
        </div>
      </div>

      {/* Chessboard */}
      <div className="w-full max-w-[600px] aspect-square mx-auto">
        <Chessboard options={{
          position: fen,
          boardOrientation: isWhite ? "white" : "black",
          onPieceDrop: ({ sourceSquare, targetSquare }: { piece: string; sourceSquare: string; targetSquare: string }) => {
            if (!targetSquare) return false;
            return onDrop(sourceSquare, targetSquare);
          },
          allowDragging: myTurn && !gameEnded,
          darkSquareStyle: { backgroundColor: "#312e81" },
          lightSquareStyle: { backgroundColor: "#e0e7ff" },
          boardStyle: { borderRadius: "8px", overflow: "hidden" },
        }} />
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
          myTurn && !gameEnded ? "bg-ccb-primary/10 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
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

      <div className="text-center text-xs text-ccb-muted">
        Move {game.move_count} · {game.time_control} · {game.rated ? "Ranked" : "Casual"}
      </div>
    </div>
  );
}
