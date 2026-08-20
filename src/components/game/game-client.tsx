"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useRealtimeGame, type GameState } from "@/hooks/use-realtime-game";
import { Clock, Flag, Eye, ArrowLeft, Volume2, VolumeX, Palette, X, MessageCircle, MoreVertical, Handshake } from "lucide-react";
import Link from "next/link";
import { getCapturedPieces, getCheckSquare } from "@/lib/game/board-helpers";
import { playSound, detectMoveSound, setSoundEnabled } from "@/lib/game/sound";
import { getStoredBoardTheme, type BoardTheme } from "@/lib/game/board-themes";
import { useBoardSize } from "@/hooks/use-board-size";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import MoveScroller from "./move-scroller";
import CapturedPieces from "./captured-pieces";
import VictoryOverlay, { type GameOutcome } from "./victory-overlay";
import PromotionDialog from "./promotion-dialog";
import BoardThemePicker from "./board-theme-picker";
import OpeningBadge from "./opening-badge";
import GameChat from "./game-chat";

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
  abort: "Game Aborted — opponent no-show",
};

type SheetType = "chat" | "theme" | "menu" | null;

function formatClock(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return `0:${seconds.toString().padStart(2, "0")}`;
}

export default function GameClient({ gameId, initialGame, currentUserId, isSpectator = false, whiteName = "White", blackName = "Black" }: GameClientProps) {
  const { game, connected, error, drawOffer, makeMove, resign, checkTimeout, setGame, offerDraw, acceptDraw, declineDraw } = useRealtimeGame(gameId, initialGame);
  const [chess] = useState(() => new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [viewPly, setViewPly] = useState(0); // which ply the board is showing (0 = start, moves.length = live)
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(getStoredBoardTheme());
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState<string[]>([]);
  const [premove, setPremove] = useState<{ from: string; to: string } | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [clockTick, setClockTick] = useState(0);
  const [desktopTab, setDesktopTab] = useState<"moves" | "chat">("moves");
  const lastFenRef = useRef(game.fen);
  const soundPlayedForEnd = useRef(false);
  const prevFenRef = useRef(game.fen);
  const { containerRef: boardContainerRef, size: boardSize } = useBoardSize(600, 220);

  useLockBodyScroll();

  useEffect(() => {
    if (drawOffer === "offer") {
      // opponentDrawOffer handled in UI
    }
  }, [drawOffer]);

  const isWhite = game.white_player_id === currentUserId;
  const isBlack = game.black_player_id === currentUserId;
  const myTurn = (isWhite && game.turn === "white") || (isBlack && game.turn === "black");
  const gameEnded = game.status !== "playing";

  // Track whether we're viewing live or a past position
  const isLiveView = viewPly === 0 || viewPly >= moveHistory.length;

  // Live clock re-render tick
  useEffect(() => {
    if (gameEnded) return;
    const interval = setInterval(() => setClockTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [gameEnded]);

  // Poll for expired opponent clock
  useEffect(() => {
    if (gameEnded || isSpectator) return;
    const interval = setInterval(() => {
      checkTimeout();
    }, 4000);
    return () => clearInterval(interval);
  }, [gameEnded, isSpectator, checkTimeout]);

  const myRatingChange = isWhite ? game.white_rating_change : game.black_rating_change;

  // Derived: captured pieces, check square
  const captured = useMemo(() => getCapturedPieces(fen), [fen]);
  const checkSquare = useMemo(() => getCheckSquare(fen), [fen]);

  // Play sounds when FEN changes (opponent moves come via realtime)
  useEffect(() => {
    if (prevFenRef.current !== game.fen && !pendingPromotion) {
      try {
        const tempGame = new Chess(prevFenRef.current);
        const nextGame = new Chess(game.fen);
        const history = nextGame.history({ verbose: true });
        const last = history[history.length - 1];
        if (last) {
          const soundType = detectMoveSound(last);
          playSound(soundType);
          if (nextGame.inCheck() && !nextGame.isCheckmate()) {
            setTimeout(() => playSound("check"), 100);
          }
        }
      } catch {}
    }
    prevFenRef.current = game.fen;
  }, [game.fen, pendingPromotion]);

  // Play game-over sound
  useEffect(() => {
    if (gameEnded && !soundPlayedForEnd.current) {
      soundPlayedForEnd.current = true;
      playSound("gameEnd");
    }
  }, [gameEnded]);

  // Build move history from game PGN when FEN changes
  useEffect(() => {
    setFen(game.fen);
    lastFenRef.current = game.fen;
    try {
      if (game.pgn) {
        const pgnGame = new Chess();
        pgnGame.loadPgn(game.pgn);
        const moves = pgnGame.history();
        setMoveHistory(moves);
        // Auto-follow live position
        setViewPly(moves.length);
        const verbose = pgnGame.history({ verbose: true });
        const last = verbose[verbose.length - 1];
        setLastMove(last ? { from: last.from, to: last.to } : null);
      } else {
        setMoveHistory([]);
        setViewPly(0);
        setLastMove(null);
      }
    } catch {
      setMoveHistory([]);
      setViewPly(0);
      setLastMove(null);
    }
  }, [game.fen, game.pgn]);

  // When viewPly changes (user navigating), reconstruct the FEN for that ply
  useEffect(() => {
    if (viewPly === 0 || moveHistory.length === 0) {
      if (game.pgn) {
        setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        setLastMove(null);
      }
      return;
    }
    if (viewPly >= moveHistory.length) {
      // Live position
      setFen(game.fen);
      return;
    }
    // Reconstruct FEN at specific ply
    try {
      const tempGame = new Chess();
      for (let i = 0; i < viewPly; i++) {
        tempGame.move(moveHistory[i]);
      }
      setFen(tempGame.fen());
      const verbose = tempGame.history({ verbose: true });
      const last = verbose[verbose.length - 1];
      setLastMove(last ? { from: last.from, to: last.to } : null);
    } catch {}
  }, [viewPly]); // eslint-disable-line react-hooks/exhaustive-deps

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: "radial-gradient(circle, rgba(139,92,246,0.35) 70%, transparent 72%)" };
      styles[lastMove.to] = { background: "radial-gradient(circle, rgba(139,92,246,0.35) 70%, transparent 72%)" };
    }
    if (checkSquare && isLiveView) {
      styles[checkSquare] = {
        background: "radial-gradient(circle, rgba(239,68,68,0.6) 60%, transparent 62%)",
        boxShadow: "inset 0 0 12px rgba(239,68,68,0.5)",
      };
    }
    for (const sq of legalMoveSquares) {
      styles[sq] = {
        background: "radial-gradient(circle, rgba(139,92,246,0.25) 22%, transparent 24%)",
      };
    }
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        background: "radial-gradient(circle, rgba(139,92,246,0.4) 70%, transparent 72%)",
      };
    }
    if (premove) {
      styles[premove.from] = {
        ...styles[premove.from],
        background: "radial-gradient(circle, rgba(251,191,36,0.4) 70%, transparent 72%)",
        boxShadow: "inset 0 0 0 3px rgba(251,191,36,0.6)",
      };
      styles[premove.to] = {
        ...styles[premove.to],
        background: "radial-gradient(circle, rgba(251,191,36,0.35) 70%, transparent 72%)",
        boxShadow: "inset 0 0 0 3px rgba(251,191,36,0.5)",
      };
    }
    return styles;
  }, [lastMove, checkSquare, legalMoveSquares, selectedSquare, premove, isLiveView]);

  const getLiveClock = (player: "white" | "black") => {
    if (!game.last_move_at || !game.white_clock_ms || !game.black_clock_ms) return "—";
    if (gameEnded || game.turn !== player) {
      return formatClock(player === "white" ? game.white_clock_ms : game.black_clock_ms);
    }
    const elapsed = Date.now() - new Date(game.last_move_at).getTime();
    void clockTick;
    const baseMs = player === "white" ? game.white_clock_ms : game.black_clock_ms;
    return formatClock(Math.max(0, baseMs - elapsed));
  };

  const isPromotionMove = useCallback((from: string, to: string): boolean => {
    const game2 = new Chess(fen);
    const piece = game2.get(from as any);
    if (!piece || piece.type !== "p") return false;
    const rank = to[1];
    return (piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1");
  }, [fen]);

  const handlePieceClick = useCallback(({ square, piece }: { square: string | null; piece: { pieceType: string } | null }) => {
    if (isSpectator || !myTurn || gameEnded || !piece || !square) return;
    if (!isLiveView) return; // Don't allow moves while reviewing
    const game = new Chess(fen);
    const squarePiece = game.get(square as any);
    if (!squarePiece) return;
    const isMyPiece = (isWhite && squarePiece.color === "w") || (isBlack && squarePiece.color === "b");
    if (!isMyPiece) {
      setSelectedSquare(null);
      setLegalMoveSquares([]);
      return;
    }
    setSelectedSquare(square);
    const moves = game.moves({ square: square as any, verbose: true });
    setLegalMoveSquares(moves.map((m: any) => m.to));
  }, [isSpectator, myTurn, gameEnded, fen, isWhite, isBlack, isLiveView]);

  const handleSquareClick = useCallback(({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
    if (selectedSquare && square !== selectedSquare) {
      if (legalMoveSquares.includes(square)) {
        if (isPromotionMove(selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square });
        } else {
          try {
            const tempGame = new Chess(fen);
            const move = tempGame.move({ from: selectedSquare, to: square, promotion: "q" });
            if (move !== null) {
              setFen(tempGame.fen());
              setMoveHistory(tempGame.history());
              setViewPly(tempGame.history().length);
              setLastMove({ from: selectedSquare, to: square });
              playSound(detectMoveSound(move));
              if (tempGame.inCheck() && !tempGame.isCheckmate()) {
                setTimeout(() => playSound("check"), 100);
              }
              makeMove(selectedSquare, square);
            }
          } catch {}
        }
      }
      setSelectedSquare(null);
      setLegalMoveSquares([]);
    } else {
      handlePieceClick({ square, piece });
    }
  }, [selectedSquare, legalMoveSquares, isPromotionMove, fen, makeMove, handlePieceClick]);

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (isSpectator || gameEnded) return false;
      if (!isLiveView) return false; // Don't allow moves while reviewing
      if (myTurn) {
        if (isPromotionMove(sourceSquare, targetSquare)) {
          setPendingPromotion({ from: sourceSquare, to: targetSquare });
          return false;
        }
        try {
          const tempGame = new Chess(fen);
          const move = tempGame.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
          if (move === null) return false;
          setFen(tempGame.fen());
          setMoveHistory(tempGame.history());
          setViewPly(tempGame.history().length);
          setLastMove({ from: sourceSquare, to: targetSquare });
          playSound(detectMoveSound(move));
          if (tempGame.inCheck() && !tempGame.isCheckmate()) {
            setTimeout(() => playSound("check"), 100);
          }
        } catch {
          return false;
        }
        makeMove(sourceSquare, targetSquare);
        return true;
      }
      // Premove
      if (!targetSquare) return false;
      const game = new Chess(fen);
      const piece = game.get(sourceSquare as any);
      if (!piece) return false;
      const isMyPiece = (isWhite && piece.color === "w") || (isBlack && piece.color === "b");
      if (!isMyPiece) return false;
      setPremove({ from: sourceSquare, to: targetSquare });
      return true;
    },
    [isSpectator, myTurn, gameEnded, fen, makeMove, isPromotionMove, isWhite, isBlack, isLiveView]
  );

  const handlePromotionSelect = useCallback((piece: "q" | "r" | "b" | "n") => {
    if (pendingPromotion) {
      try {
        const tempGame = new Chess(fen);
        const move = tempGame.move({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece });
        if (move) {
          setFen(tempGame.fen());
          setMoveHistory(tempGame.history());
          setViewPly(tempGame.history().length);
          setLastMove({ from: pendingPromotion.from, to: pendingPromotion.to });
          playSound(detectMoveSound(move));
        }
      } catch {}
      makeMove(pendingPromotion.from, pendingPromotion.to);
    }
    setPendingPromotion(null);
  }, [pendingPromotion, fen, makeMove]);

  const handleResign = async () => {
    await resign();
    setShowResignConfirm(false);
  };

  const toggleSound = () => {
    const newVal = !soundOn;
    setSoundOn(newVal);
    setSoundEnabled(newVal);
  };

  useEffect(() => {
    playSound("gameStart");
  }, []);

  const toggleSheet = (sheet: SheetType) => setActiveSheet((prev) => (prev === sheet ? null : sheet));

  // Player bar component — chess.com style: avatar, name, rating, captured, clock
  const renderPlayerBar = (data: { name: string; rating?: number | string | null; symbol: string; captured: string[]; advantage: number; clock: string; isActive: boolean }) => (
    <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
          <span className="text-base">{data.symbol}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium leading-tight truncate">{data.name}</span>
          <div className="flex items-center gap-2">
            {data.rating && <span className="text-xs text-ccb-muted shrink-0">{data.rating}</span>}
            <CapturedPieces pieces={data.captured} advantage={data.advantage} perspective="top" />
          </div>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-lg font-bold transition-colors shrink-0 ${
        data.isActive ? "bg-ccb-primary/15 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
      }`}>
        <Clock className="w-4 h-4" />
        {data.clock}
      </div>
    </div>
  );

  // ============ SHARED BOARD COLUMN ============
  const boardColumn = (topPlayer: any, bottomPlayer: any, showControls: boolean) => (
    <div className="relative flex flex-col h-full w-full lg:w-[600px] lg:max-w-[600px] lg:h-auto lg:shrink-0 lg:my-auto">
      {/* Mobile top bar */}
      <div className="lg:hidden shrink-0 flex items-center justify-between px-3 h-11 border-b border-ccb-border">
        <Link href="/play" className="p-1.5 -ml-1.5 text-ccb-muted hover:text-ccb-primary">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="text-sm font-medium text-ccb-muted truncate flex items-center gap-1.5">
          {isSpectator && <Eye className="w-3.5 h-3.5" />}
          {game.time_control} · {game.rated ? "Ranked" : "Casual"}
        </span>
        <button onClick={() => toggleSheet("menu")} className="p-1.5 -mr-1.5 text-ccb-muted hover:text-ccb-primary">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {!connected && (
        <div className="shrink-0 rounded-lg bg-ccb-surface border border-ccb-border text-ccb-muted px-4 py-1.5 text-xs text-center max-w-[600px] mx-auto w-full mt-1">
          Connecting...
        </div>
      )}

      {/* Opponent bar */}
      {renderPlayerBar(topPlayer)}

      {/* Horizontal move scroller — chess.com style, above the board */}
      <div className="max-w-[600px] mx-auto w-full px-2 py-1">
        {moveHistory.length >= 2 && (
          <div className="mb-1">
            <OpeningBadge moves={moveHistory} />
          </div>
        )}
        <div className="rounded-lg bg-ccb-surface/50 border border-ccb-border/50 px-2 py-1.5">
          <MoveScroller moves={moveHistory} currentPly={viewPly} onPlyChange={setViewPly} />
        </div>
      </div>

      {/* Board */}
      <div ref={boardContainerRef} className="flex-1 min-h-0 flex items-center justify-center px-2 py-1">
        <div style={{ width: boardSize, height: boardSize }}>
          <Chessboard options={{
            position: fen,
            boardOrientation: isWhite || isSpectator ? "white" : "black",
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!targetSquare) return false;
              return onDrop(sourceSquare, targetSquare);
            },
            allowDragging: !gameEnded && !isSpectator && isLiveView,
            squareStyles: squareStyles,
            showAnimations: true,
            animationDurationInMs: 300,
            showNotation: true,
            darkSquareNotationStyle: { color: boardTheme.light, fontSize: "10px", fontWeight: 600 },
            lightSquareNotationStyle: { color: boardTheme.dark, fontSize: "10px", fontWeight: 600 },
            onPieceClick: handlePieceClick,
            onSquareClick: handleSquareClick,
            darkSquareStyle: { backgroundColor: boardTheme.dark },
            lightSquareStyle: { backgroundColor: boardTheme.light },
            boardStyle: { borderRadius: "8px", overflow: "hidden" },
          }} />
        </div>
      </div>

      {/* Your bar */}
      {renderPlayerBar(bottomPlayer)}

      {/* Draw offer banner */}
      {drawOffer === "offer" && !isSpectator && !gameEnded && (
        <div className="max-w-[600px] mx-auto w-full px-2 py-2">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-ccb-primary/10 border border-ccb-primary/30">
            <span className="text-sm flex items-center gap-1.5">
              <Handshake className="w-4 h-4 text-ccb-primary" /> Opponent offers a draw
            </span>
            <div className="flex gap-2">
              <button onClick={acceptDraw} className="btn-primary text-sm px-4 py-1.5">Accept</button>
              <button onClick={declineDraw} className="btn-secondary text-sm px-4 py-1.5">Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* Live position indicator when reviewing past moves */}
      {!isLiveView && moveHistory.length > 0 && (
        <div className="max-w-[600px] mx-auto w-full px-2">
          <button
            onClick={() => setViewPly(moveHistory.length)}
            className="w-full text-center text-xs text-ccb-primary hover:underline py-1"
          >
            ← Return to live position
          </button>
        </div>
      )}

      {/* Desktop resign/draw controls */}
      {showControls && !gameEnded && (
        <div className="hidden lg:flex items-center justify-center gap-3 max-w-[600px] mx-auto mt-2 shrink-0">
          {showResignConfirm ? (
            <>
              <span className="text-sm text-ccb-muted">Resign?</span>
              <button onClick={handleResign} className="btn bg-ccb-danger text-white px-4 py-2 text-sm">Yes, resign</button>
              <button onClick={() => setShowResignConfirm(false)} className="btn-secondary text-sm">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowResignConfirm(true)} className="btn-secondary text-sm">
                <Flag className="w-4 h-4 mr-1" /> Resign
              </button>
              <button onClick={offerDraw} className="btn-secondary text-sm">
                <Handshake className="w-4 h-4 mr-1" /> Offer Draw
              </button>
            </>
          )}
        </div>
      )}

      {/* Mobile bottom toolbar — Resign, Draw, Chat */}
      <div className="lg:hidden shrink-0 border-t border-ccb-border" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {showResignConfirm ? (
          <div className="flex items-center justify-center gap-3 h-14">
            <span className="text-sm text-ccb-muted">Resign?</span>
            <button onClick={handleResign} className="btn bg-ccb-danger text-white px-4 py-1.5 text-sm">Yes</button>
            <button onClick={() => setShowResignConfirm(false)} className="btn-secondary text-sm px-4 py-1.5">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center justify-around h-14">
            <button
              onClick={() => toggleSheet("chat")}
              className={`flex flex-col items-center gap-0.5 flex-1 py-1 ${activeSheet === "chat" ? "text-ccb-primary" : "text-ccb-muted"}`}
            >
              <MessageCircle className="w-5 h-5" /><span className="text-[10px]">Chat</span>
            </button>
            <button
              onClick={offerDraw}
              disabled={gameEnded || isSpectator}
              className="flex flex-col items-center gap-0.5 flex-1 py-1 text-ccb-muted disabled:opacity-40"
            >
              <Handshake className="w-5 h-5" /><span className="text-[10px]">Draw</span>
            </button>
            <button
              onClick={() => setShowResignConfirm(true)}
              disabled={gameEnded || isSpectator}
              className="flex flex-col items-center gap-0.5 flex-1 py-1 text-ccb-danger disabled:opacity-40"
            >
              <Flag className="w-5 h-5" /><span className="text-[10px]">Resign</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile bottom sheet (Chat + Theme) */}
      {activeSheet && activeSheet !== "menu" && (
        <div className="lg:hidden absolute inset-x-2 bottom-16 z-20 max-h-[45%] rounded-xl border border-ccb-border bg-ccb-card shadow-2xl animate-sheet-up flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-ccb-border shrink-0">
            <span className="text-sm font-medium">
              {activeSheet === "chat" ? "Chat" : "Board Theme"}
            </span>
            <button onClick={() => setActiveSheet(null)} className="text-ccb-muted hover:text-ccb-primary p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
            {activeSheet === "chat" && <GameChat gameId={gameId} currentUserId={currentUserId} currentUserName={isWhite ? whiteName : blackName} opponentName={isWhite ? blackName : whiteName} isSpectator={isSpectator} />}
            {activeSheet === "theme" && <BoardThemePicker inline onThemeChange={setBoardTheme} />}
          </div>
        </div>
      )}

      {/* Mobile menu dropdown */}
      {activeSheet === "menu" && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setActiveSheet(null)}>
          <div className="absolute top-12 right-3 card p-2 min-w-[180px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={toggleSound} className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-ccb-surface transition-colors text-sm">
              <span>Sound</span>
              {soundOn ? <Volume2 className="w-4 h-4 text-ccb-primary" /> : <VolumeX className="w-4 h-4 text-ccb-muted" />}
            </button>
            <button onClick={() => { setActiveSheet("theme"); }} className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-ccb-surface transition-colors text-sm">
              <span>Board Theme</span>
              <Palette className="w-4 h-4 text-ccb-muted" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ============ SPECTATOR VIEW ============
  if (isSpectator) {
    const topPlayer = { name: blackName, rating: game.black_rating, captured: captured.black, advantage: -captured.advantage, clock: getLiveClock("black"), isActive: game.turn === "black" && !gameEnded, symbol: "♚" };
    const bottomPlayer = { name: whiteName, rating: game.white_rating, captured: captured.white, advantage: captured.advantage, clock: getLiveClock("white"), isActive: game.turn === "white" && !gameEnded, symbol: "♔" };

    return (
      <>
        <div className="game-viewport -my-4 sm:-my-6 flex flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-6">
          {boardColumn(topPlayer, bottomPlayer, false)}

          {/* Desktop-only sidebar */}
          <div className="hidden lg:flex lg:flex-col lg:w-[280px] lg:shrink-0 lg:h-full lg:py-2 gap-3">
            <div className="flex flex-col gap-3 h-full overflow-y-auto no-scrollbar">
              <div className="card flex items-center justify-between shrink-0">
                <Link href="/play" className="text-sm text-ccb-muted hover:text-ccb-primary flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Link>
                <div className="flex items-center gap-2">
                  <button onClick={toggleSound} className="text-ccb-muted hover:text-ccb-primary transition-colors p-1">
                    {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <div className="flex items-center gap-2 text-sm text-ccb-muted">
                    <Eye className="w-4 h-4" /><span>Spectating</span>
                  </div>
                  <BoardThemePicker onThemeChange={setBoardTheme} />
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setDesktopTab("moves")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${desktopTab === "moves" ? "bg-ccb-primary/10 text-ccb-primary" : "text-ccb-muted hover:text-ccb-text"}`}>Moves</button>
                <button onClick={() => setDesktopTab("chat")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${desktopTab === "chat" ? "bg-ccb-primary/10 text-ccb-primary" : "text-ccb-muted hover:text-ccb-text"}`}>Chat</button>
              </div>

              {desktopTab === "moves" ? (
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                  <div className="space-y-0.5">
                    {moveHistory.length === 0 ? <p className="text-xs text-ccb-muted text-center py-4">No moves yet</p> : null}
                    {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm rounded-md hover:bg-ccb-surface/50 px-1 py-0.5">
                        <span className="text-ccb-muted text-xs font-mono w-6 text-right shrink-0">{i + 1}.</span>
                        <button onClick={() => setViewPly(i * 2 + 1)} className={`font-mono flex-1 text-left rounded px-1 ${viewPly === i * 2 + 1 ? "bg-ccb-primary text-white" : "text-ccb-text"}`}>{moveHistory[i * 2] || ""}</button>
                        <button onClick={() => setViewPly(i * 2 + 2)} className={`font-mono flex-1 text-left rounded px-1 ${viewPly === i * 2 + 2 ? "bg-ccb-primary text-white" : "text-ccb-text"}`}>{moveHistory[i * 2 + 1] || ""}</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-ccb-border overflow-hidden">
                  <GameChat gameId={gameId} currentUserId={currentUserId} currentUserName={isWhite ? whiteName : blackName} opponentName={isWhite ? blackName : whiteName} isSpectator={isSpectator} />
                </div>
              )}
            </div>
          </div>
        </div>

        <PromotionDialog visible={!!pendingPromotion} color={isWhite ? "white" : "black"} onSelect={handlePromotionSelect} onCancel={() => setPendingPromotion(null)} />
        <VictoryOverlay
          visible={gameEnded}
          outcome={(game.winner === null ? "draw" : game.winner === (isWhite ? "white" : "black") ? "win" : "loss") as GameOutcome}
          reasonLabel={STATUS_LABELS[game.status] || game.status}
          ratingChange={myRatingChange}
          berriesAwarded={game.winner && game.winner === (isWhite ? "white" : "black") ? (game.rated ? 10 : 15) : 0}
          moveCount={game.move_count}
          subtitle={`${game.time_control} · ${game.rated ? "Ranked" : "Casual"}`}
          lobbyHref="/play"
        />
      </>
    );
  }

  // ============ PLAYER VIEW ============
  const playerData = isWhite
    ? { name: blackName, rating: game.black_rating, captured: captured.black, advantage: -captured.advantage, clock: getLiveClock("black"), isActive: game.turn === "black" && !gameEnded, symbol: "♚" }
    : { name: whiteName, rating: game.white_rating, captured: captured.white, advantage: captured.advantage, clock: getLiveClock("white"), isActive: game.turn === "white" && !gameEnded, symbol: "♔" };

  const myData = isWhite
    ? { name: whiteName, rating: game.white_rating, captured: captured.white, advantage: captured.advantage, clock: getLiveClock("white"), isActive: game.turn === "white" && !gameEnded, symbol: "♔" }
    : { name: blackName, rating: game.black_rating, captured: captured.black, advantage: -captured.advantage, clock: getLiveClock("black"), isActive: game.turn === "black" && !gameEnded, symbol: "♚" };

  return (
    <>
      <div className="game-viewport -my-4 sm:-my-6 flex flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-6">
        {boardColumn(playerData, myData, true)}

        {/* Desktop-only sidebar */}
        <div className="hidden lg:flex lg:flex-col lg:w-[280px] lg:shrink-0 lg:h-full lg:py-2 gap-3">
          <div className="flex flex-col gap-3 h-full overflow-y-auto no-scrollbar">
            <div className="card flex items-center justify-between shrink-0">
              <Link href="/play" className="text-sm text-ccb-muted hover:text-ccb-primary flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </Link>
              <div className="flex items-center gap-2">
                <button onClick={toggleSound} className="text-ccb-muted hover:text-ccb-primary transition-colors p-1">
                  {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <BoardThemePicker onThemeChange={setBoardTheme} />
              </div>
            </div>
            <div className="card flex items-center justify-between shrink-0">
              <div className="text-xs text-ccb-muted">
                {game.time_control} · {game.rated ? "Ranked" : "Casual"}
              </div>
            </div>

            {moveHistory.length >= 2 && <div className="shrink-0"><OpeningBadge moves={moveHistory} /></div>}

            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setDesktopTab("moves")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${desktopTab === "moves" ? "bg-ccb-primary/10 text-ccb-primary" : "text-ccb-muted hover:text-ccb-text"}`}>Moves</button>
              <button onClick={() => setDesktopTab("chat")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${desktopTab === "chat" ? "bg-ccb-primary/10 text-ccb-primary" : "text-ccb-muted hover:text-ccb-text"}`}>Chat</button>
            </div>

            {desktopTab === "moves" ? (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                  <div className="space-y-0.5">
                    {moveHistory.length === 0 ? <p className="text-xs text-ccb-muted text-center py-4">No moves yet</p> : null}
                    {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm rounded-md hover:bg-ccb-surface/50 px-1 py-0.5">
                        <span className="text-ccb-muted text-xs font-mono w-6 text-right shrink-0">{i + 1}.</span>
                        <button onClick={() => setViewPly(i * 2 + 1)} className={`font-mono flex-1 text-left rounded px-1 ${viewPly === i * 2 + 1 ? "bg-ccb-primary text-white" : "text-ccb-text"}`}>{moveHistory[i * 2] || ""}</button>
                        <button onClick={() => setViewPly(i * 2 + 2)} className={`font-mono flex-1 text-left rounded px-1 ${viewPly === i * 2 + 2 ? "bg-ccb-primary text-white" : "text-ccb-text"}`}>{moveHistory[i * 2 + 1] || ""}</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center text-xs text-ccb-muted shrink-0">
                  Move {game.move_count} · {game.time_control}
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-ccb-border overflow-hidden">
                <GameChat gameId={gameId} currentUserId={currentUserId} currentUserName={isWhite ? whiteName : blackName} opponentName={isWhite ? blackName : whiteName} isSpectator={isSpectator} />
              </div>
            )}
          </div>
        </div>
      </div>

      <PromotionDialog visible={!!pendingPromotion} color={isWhite ? "white" : "black"} onSelect={handlePromotionSelect} onCancel={() => setPendingPromotion(null)} />
      <VictoryOverlay
        visible={gameEnded}
        outcome={(game.winner === null ? "draw" : game.winner === (isWhite ? "white" : "black") ? "win" : "loss") as GameOutcome}
        reasonLabel={STATUS_LABELS[game.status] || game.status}
        ratingChange={myRatingChange}
        berriesAwarded={game.winner && game.winner === (isWhite ? "white" : "black") ? (game.rated ? 10 : 15) : 0}
        moveCount={game.move_count}
        subtitle={`${game.time_control} · ${game.rated ? "Ranked" : "Casual"}`}
        lobbyHref="/play"
      />
    </>
  );
}
