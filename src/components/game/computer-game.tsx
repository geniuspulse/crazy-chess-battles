"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Clock, Flag, ArrowLeft, Bot, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { getBestMove, type AIDifficulty } from "@/lib/game/chess-ai";
import { getCapturedPieces, getCheckSquare } from "@/lib/game/board-helpers";
import { playSound, detectMoveSound, setSoundEnabled, isSoundEnabled } from "@/lib/game/sound";
import { getStoredBoardTheme, type BoardTheme } from "@/lib/game/board-themes";
import MoveHistory from "./move-history";
import CapturedPieces from "./captured-pieces";
import VictoryOverlay, { type GameOutcome } from "./victory-overlay";
import PromotionDialog from "./promotion-dialog";
import BoardThemePicker from "./board-theme-picker";
import QuickReactions from "./quick-reactions";

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
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [turn, setTurn] = useState<"white" | "black">("white");
  const [status, setStatus] = useState("playing");
  const [winner, setWinner] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [whiteClock, setWhiteClock] = useState(initialMinutes * 60 * 1000);
  const [blackClock, setBlackClock] = useState(initialMinutes * 60 * 1000);
  const [lastMoveAt, setLastMoveAt] = useState(Date.now());
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(getStoredBoardTheme());
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundPlayedForEnd = useRef(false);

  const isPlayerWhite = playerColor === "white";
  const isPlayerTurn = (isPlayerWhite && turn === "white") || (!isPlayerWhite && turn === "black");
  const gameEnded = status !== "playing";
  const aiColor = isPlayerWhite ? "black" : "white";

  // Derived: captured pieces, check square, board highlights
  const captured = useMemo(() => getCapturedPieces(fen), [fen]);
  const checkSquare = useMemo(() => getCheckSquare(fen), [fen]);

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
    // Legal move hints
    for (const sq of legalMoveSquares) {
      styles[sq] = {
        background: "radial-gradient(circle, rgba(139,92,246,0.25) 22%, transparent 24%)",
      };
    }
    // Selected square highlight
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        background: "radial-gradient(circle, rgba(139,92,246,0.4) 70%, transparent 72%)",
      };
    }
    return styles;
  }, [lastMove, checkSquare, legalMoveSquares, selectedSquare]);

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

  // Play game-over sound when game ends
  useEffect(() => {
    if (gameEnded && !soundPlayedForEnd.current) {
      soundPlayedForEnd.current = true;
      playSound("gameEnd");
    }
  }, [gameEnded]);

  // Apply a move with sound
  const applyMove = useCallback((from: string, to: string, promotion: string = "q") => {
    try {
      const result = chessRef.current.move({ from, to, promotion });
      if (result === null) return false;

      // Play sound based on move type
      const soundType = detectMoveSound(result);
      playSound(soundType);
      // Check sound if in check after the move
      if (chessRef.current.inCheck() && !chessRef.current.isCheckmate()) {
        setTimeout(() => playSound("check"), 100);
      }

      const now = Date.now();
      const elapsed = now - lastMoveAt;

      if (turn === "white") {
        const newWhite = whiteClock - elapsed + incrementSeconds * 1000;
        setWhiteClock(Math.max(0, Math.floor(newWhite)));
      } else {
        const newBlack = blackClock - elapsed + incrementSeconds * 1000;
        setBlackClock(Math.max(0, Math.floor(newBlack)));
      }

      setFen(chessRef.current.fen());
      setTurn(chessRef.current.turn() === "w" ? "white" : "black");
      setMoveCount(chessRef.current.history().length);
      setMoveHistory(chessRef.current.history());
      setLastMove({ from, to });
      setLastMoveAt(now);

      if (chessRef.current.isCheckmate()) {
        setStatus("checkmate");
        setWinner(turn);
      } else if (chessRef.current.isStalemate()) {
        setStatus("stalemate");
      } else if (chessRef.current.isDraw() || chessRef.current.isThreefoldRepetition() || chessRef.current.isInsufficientMaterial()) {
        setStatus("draw");
      }

      return true;
    } catch {
      return false;
    }
  }, [turn, whiteClock, blackClock, lastMoveAt, incrementSeconds]);

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
    }, 300 + Math.random() * 700);
    return () => clearTimeout(timeout);
  }, [turn, gameEnded, isPlayerTurn, fen, difficulty, applyMove]);

  // Check if a move is a pawn promotion
  const isPromotionMove = useCallback((from: string, to: string): boolean => {
    const game = new Chess(fen);
    const piece = game.get(from as any);
    if (!piece || piece.type !== "p") return false;
    const rank = to[1];
    return (piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1");
  }, [fen]);


  // Handle piece click — show legal moves
  const handlePieceClick = useCallback(({ square, piece }: { square: string | null; piece: { pieceType: string } | null }) => {
    if (!isPlayerTurn || gameEnded) return;
    if (!piece) return;
    // Check if it's our piece
    const game = new Chess(fen);
    const squarePiece = game.get(square as any);
    if (!squarePiece) return;
    const isMyPiece = (isPlayerWhite && squarePiece.color === "w") || (!isPlayerWhite && squarePiece.color === "b");
    if (!isMyPiece) {
      setSelectedSquare(null);
      setLegalMoveSquares([]);
      return;
    }
    setSelectedSquare(square);
    // Get legal moves from this square
    const moves = game.moves({ square: square as any, verbose: true });
    setLegalMoveSquares(moves.map((m: any) => m.to));
  }, [isPlayerTurn, gameEnded, fen, isPlayerWhite]);

  // Handle square click — if a legal move target, make the move
  const handleSquareClick = useCallback(({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
    if (selectedSquare && legalMoveSquares.includes(square)) {
      // Check promotion
      if (isPromotionMove(selectedSquare, square)) {
        setPendingPromotion({ from: selectedSquare, to: square });
      } else {
        applyMove(selectedSquare, square, "q");
      }
      setSelectedSquare(null);
      setLegalMoveSquares([]);
    } else if (!piece) {
      setSelectedSquare(null);
      setLegalMoveSquares([]);
    }
  }, [selectedSquare, legalMoveSquares, isPromotionMove, applyMove]);

  // Player drop handler — intercept promotions
  const onDrop = useCallback((sourceSquare: string, targetSquare: string): boolean => {
    if (!isPlayerTurn || gameEnded) return false;
    // Check if this is a promotion move
    if (isPromotionMove(sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return false; // don't apply yet — wait for user selection
    }
    return applyMove(sourceSquare, targetSquare, "q");
  }, [isPlayerTurn, gameEnded, isPromotionMove, applyMove]);

  // Handle promotion selection
  const handlePromotionSelect = useCallback((piece: "q" | "r" | "b" | "n") => {
    if (pendingPromotion) {
      applyMove(pendingPromotion.from, pendingPromotion.to, piece);
    }
    setPendingPromotion(null);
  }, [pendingPromotion, applyMove]);

  const handleResign = () => {
    setStatus("resign");
    setWinner(aiColor);
    setShowResignConfirm(false);
  };

  const handleNewGame = () => {
    chessRef.current.reset();
    setFen(chessRef.current.fen());
    setTurn("white");
    setStatus("playing");
    setWinner(null);
    setMoveCount(0);
    setMoveHistory([]);
    setLastMove(null);
    setSelectedSquare(null);
    setLegalMoveSquares([]);
    setWhiteClock(initialMinutes * 60 * 1000);
    setBlackClock(initialMinutes * 60 * 1000);
    setLastMoveAt(Date.now());
    soundPlayedForEnd.current = false;
    playSound("gameStart");
  };

  const toggleSound = () => {
    const newVal = !soundOn;
    setSoundOn(newVal);
    setSoundEnabled(newVal);
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
        const move = getBestMove(chessRef.current.fen(), difficulty);
        if (move) applyMove(move.from, move.to, move.promotion || "q");
        setAiThinking(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isPlayerWhite, turn, status, moveCount, difficulty, applyMove]);

  // Play game start sound on mount
  useEffect(() => {
    playSound("gameStart");
  }, []);

  const opponentData = isPlayerWhite
    ? { name: DIFFICULTY_LABELS[difficulty], color: "black", symbol: "♚", captured: captured.black, advantage: -captured.advantage, clock: getLiveClock("black"), isActive: turn === "black" && !gameEnded }
    : { name: DIFFICULTY_LABELS[difficulty], color: "white", symbol: "♔", captured: captured.white, advantage: captured.advantage, clock: getLiveClock("white"), isActive: turn === "white" && !gameEnded };

  const playerData = isPlayerWhite
    ? { name: "You", color: "white", symbol: "♔", captured: captured.white, advantage: captured.advantage, clock: getLiveClock("white"), isActive: isPlayerTurn && !gameEnded }
    : { name: "You", color: "black", symbol: "♚", captured: captured.black, advantage: -captured.advantage, clock: getLiveClock("black"), isActive: isPlayerTurn && !gameEnded };

  const board = (
    <div className="w-full">
      {/* Opponent bar */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2 mb-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-ccb-muted" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">{opponentData.name}</span>
            <CapturedPieces pieces={opponentData.captured} advantage={opponentData.advantage} perspective="top" />
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
          boardOrientation: isPlayerWhite ? "white" : "black",
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            return onDrop(sourceSquare, targetSquare);
          },
          allowDragging: isPlayerTurn && !gameEnded,
          squareStyles: squareStyles,
          showAnimations: true,
          animationDurationInMs: 300,
          onPieceClick: handlePieceClick,
          onSquareClick: handleSquareClick,
          darkSquareStyle: { backgroundColor: boardTheme.dark },
          lightSquareStyle: { backgroundColor: boardTheme.light },
          boardStyle: { borderRadius: "8px", overflow: "hidden" },
        }} />
      </div>

      {/* Player bar */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2 mt-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
            <span className="text-base">{playerData.symbol}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">{playerData.name}</span>
            <CapturedPieces pieces={playerData.captured} advantage={playerData.advantage} perspective="bottom" />
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
      {/* Status header with controls */}
      <div className="card flex items-center justify-between">
        <Link href="/play" className="text-sm text-ccb-muted hover:text-ccb-primary flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={toggleSound} className="text-ccb-muted hover:text-ccb-primary transition-colors p-1" title={soundOn ? "Mute" : "Unmute"}>
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <BoardThemePicker onThemeChange={setBoardTheme} />
        </div>
      </div>

      {/* AI status */}
      <div className="card flex items-center gap-2">
        <Bot className="w-4 h-4 text-ccb-primary" />
        <span className="text-sm text-ccb-muted">{aiThinking ? "Thinking..." : DIFFICULTY_LABELS[difficulty]}</span>
      </div>

      {/* Move history */}
      <MoveHistory moves={moveHistory} />

      {/* Footer info */}
      <div className="text-center text-xs text-ccb-muted">
        Move {moveCount} · {DIFFICULTY_LABELS[difficulty]} · vs Computer
      </div>

      {/* Quick reactions */}
      <QuickReactions position="side" />
    </div>
  );

  return (
    <>
      {/* Mobile: stacked. Desktop: two-column */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start justify-center pb-20 sm:pb-0">
        <div className="w-full lg:w-[600px] lg:max-w-[600px] shrink-0">{board}</div>
        <div className="w-full lg:w-[280px] shrink-0">{sidebar}</div>
      </div>

      <PromotionDialog
        visible={!!pendingPromotion}
        color={playerColor}
        onSelect={handlePromotionSelect}
        onCancel={() => setPendingPromotion(null)}
      />

      <VictoryOverlay
        visible={gameEnded}
        outcome={(winner === null ? "draw" : winner === playerColor ? "win" : "loss") as GameOutcome}
        reasonLabel={STATUS_LABELS[status] || status}
        moveCount={moveCount}
        subtitle={`${DIFFICULTY_LABELS[difficulty]} · vs Computer`}
        onNewGame={handleNewGame}
      />
    </>
  );
}
