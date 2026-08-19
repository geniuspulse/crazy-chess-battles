"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Clock, Flag, ArrowLeft, Bot } from "lucide-react";
import Link from "next/link";
import { getBestMove, type AIDifficulty } from "@/lib/game/chess-ai";
import VictoryOverlay, { type GameOutcome } from "./victory-overlay";

interface ComputerGameProps {
  difficulty: AIDifficulty;
  playerColor: "white" | "black";
  initialMinutes: number;
  incrementSeconds: number;
}

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: "Easy Bot",
  medium: "Medium Bot",
  hard: "Hard Bot",
};

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
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function ComputerGame({ difficulty, playerColor, initialMinutes, incrementSeconds }: ComputerGameProps) {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [turn, setTurn] = useState<"white" | "black">("white");
  const [status, setStatus] = useState("playing");
  const [winner, setWinner] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [whiteClock, setWhiteClock] = useState(initialMinutes * 60 * 1000);
  const [blackClock, setBlackClock] = useState(initialMinutes * 60 * 1000);
  const [lastMoveAt, setLastMoveAt] = useState(Date.now());
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPlayerWhite = playerColor === "white";
  const isPlayerTurn = (isPlayerWhite && turn === "white") || (!isPlayerWhite && turn === "black");
  const gameEnded = status !== "playing";

  const aiColor = isPlayerWhite ? "black" : "white";

  // Live clock tick
  useEffect(() => {
    if (gameEnded) return;
    const tick = () => {
      const now = Date.now();
      const elapsed = now - lastMoveAt;
      const activeClock = turn === "white" ? whiteClock : blackClock;
      const remaining = activeClock - elapsed;
      if (remaining <= 0) {
        const loser = turn;
        const w = loser === "white" ? "black" : "white";
        setStatus("timeout");
        setWinner(w);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [turn, lastMoveAt, gameEnded, whiteClock, blackClock]);

  // Apply a move
  const applyMove = useCallback((from: string, to: string, promotion: string = "q") => {
    try {
      const result = chess.move({ from, to, promotion });
      if (result === null) return false;

      const now = Date.now();
      const elapsed = now - lastMoveAt;

      if (turn === "white") {
        const newWhite = whiteClock - elapsed + incrementSeconds * 1000;
        setWhiteClock(Math.max(0, Math.floor(newWhite)));
      } else {
        const newBlack = blackClock - elapsed + incrementSeconds * 1000;
        setBlackClock(Math.max(0, Math.floor(newBlack)));
      }

      setFen(chess.fen());
      setTurn(chess.turn() === "w" ? "white" : "black");
      setMoveCount(chess.history().length);
      setLastMoveAt(now);

      // Check game over
      if (chess.isCheckmate()) {
        setStatus("checkmate");
        setWinner(turn);
      } else if (chess.isStalemate()) {
        setStatus("stalemate");
      } else if (chess.isDraw() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
        setStatus("draw");
      }

      return true;
    } catch {
      return false;
    }
  }, [chess, turn, whiteClock, blackClock, lastMoveAt, incrementSeconds]);

  // AI makes a move
  useEffect(() => {
    if (gameEnded || isPlayerTurn) return;
    setAiThinking(true);
    const timeout = setTimeout(() => {
      const move = getBestMove(fen, difficulty);
      if (move) {
        applyMove(move.from, move.to, move.promotion || "q");
      }
      setAiThinking(false);
    }, 300 + Math.random() * 700); // small delay for realism
    return () => clearTimeout(timeout);
  }, [turn, gameEnded, isPlayerTurn, fen, difficulty, applyMove]);

  // Player drop handler
  const onDrop = useCallback((sourceSquare: string, targetSquare: string): boolean => {
    if (!isPlayerTurn || gameEnded) return false;
    return applyMove(sourceSquare, targetSquare, "q");
  }, [isPlayerTurn, gameEnded, applyMove]);

  const handleResign = () => {
    setStatus("resign");
    setWinner(aiColor);
    setShowResignConfirm(false);
  };

  const handleNewGame = () => {
    chess.reset();
    setFen(chess.fen());
    setTurn("white");
    setStatus("playing");
    setWinner(null);
    setMoveCount(0);
    setWhiteClock(initialMinutes * 60 * 1000);
    setBlackClock(initialMinutes * 60 * 1000);
    setLastMoveAt(Date.now());
  };

  const getLiveClock = (player: "white" | "black") => {
    if (gameEnded || turn !== player) {
      return formatClock(player === "white" ? whiteClock : blackClock);
    }
    const elapsed = Date.now() - lastMoveAt;
    const base = player === "white" ? whiteClock : blackClock;
    return formatClock(Math.max(0, base - elapsed));
  };

  // If AI plays white, trigger first move
  useEffect(() => {
    if (!isPlayerWhite && turn === "white" && status === "playing" && moveCount === 0) {
      setAiThinking(true);
      const timeout = setTimeout(() => {
        const move = getBestMove(chess.fen(), difficulty);
        if (move) applyMove(move.from, move.to, move.promotion || "q");
        setAiThinking(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isPlayerWhite, turn, status, moveCount, difficulty, chess, applyMove]);

  return (
    <div className="space-y-4 pb-20 sm:pb-0">
      {/* Top bar */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2">
        <Link href="/play" className="text-sm text-ccb-muted hover:text-ccb-primary flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2 text-sm text-ccb-muted">
          <Bot className="w-4 h-4" />
          <span>{aiThinking ? "Thinking..." : DIFFICULTY_LABELS[difficulty]}</span>
        </div>
      </div>

      {/* Opponent info (top) */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center">
            <Bot className="w-5 h-5 text-ccb-muted" />
          </div>
          <div>
            <div className="text-sm font-medium">{DIFFICULTY_LABELS[difficulty]}</div>
            <div className="text-xs text-ccb-muted">{aiColor === "white" ? "♔ White" : "♚ Black"}</div>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-lg font-bold ${
          turn === aiColor && !gameEnded ? "bg-ccb-primary/10 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
        }`}>
          <Clock className="w-4 h-4" />
          {getLiveClock(aiColor)}
        </div>
      </div>

      {/* Chessboard */}
      <div className="w-full max-w-[600px] aspect-square mx-auto">
        <Chessboard options={{
          position: fen,
          boardOrientation: isPlayerWhite ? "white" : "black",
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            return onDrop(sourceSquare, targetSquare);
          },
          allowDragging: isPlayerTurn && !gameEnded,
          darkSquareStyle: { backgroundColor: "#312e81" },
          lightSquareStyle: { backgroundColor: "#e0e7ff" },
          boardStyle: { borderRadius: "8px", overflow: "hidden" },
        }} />
      </div>

      {/* Player info (bottom) */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center">
            <span className="text-lg">{isPlayerWhite ? "♔" : "♚"}</span>
          </div>
          <div>
            <div className="text-sm font-medium">You</div>
            <div className="text-xs text-ccb-muted">{playerColor === "white" ? "♔ White" : "♚ Black"}</div>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-lg font-bold ${
          isPlayerTurn && !gameEnded ? "bg-ccb-primary/10 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
        }`}>
          <Clock className="w-4 h-4" />
          {getLiveClock(playerColor)}
        </div>
      </div>

      {/* Controls */}
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

      {/* Victory / defeat / draw flyover */}
      <VictoryOverlay
        visible={gameEnded}
        outcome={(winner === null ? "draw" : winner === playerColor ? "win" : "loss") as GameOutcome}
        reasonLabel={STATUS_LABELS[status] || status}
        moveCount={moveCount}
        subtitle={`${DIFFICULTY_LABELS[difficulty]} · vs Computer`}
        onNewGame={handleNewGame}
      />

      <div className="text-center text-xs text-ccb-muted">
        Move {moveCount} · {DIFFICULTY_LABELS[difficulty]} · vs Computer
      </div>
    </div>
  );
}
