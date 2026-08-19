"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useRealtimeGame, type GameState } from "@/hooks/use-realtime-game";
import { Clock, Flag, Eye, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { getCapturedPieces, getCheckSquare } from "@/lib/game/board-helpers";
import { playSound, detectMoveSound, setSoundEnabled } from "@/lib/game/sound";
import { getStoredBoardTheme, type BoardTheme } from "@/lib/game/board-themes";
import MoveHistory from "./move-history";
import CapturedPieces from "./captured-pieces";
import VictoryOverlay, { type GameOutcome } from "./victory-overlay";
import PromotionDialog from "./promotion-dialog";
import BoardThemePicker from "./board-theme-picker";

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
  const [soundOn, setSoundOn] = useState(true);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(getStoredBoardTheme());
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const lastFenRef = useRef(game.fen);
  const soundPlayedForEnd = useRef(false);
  const prevFenRef = useRef(game.fen);

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

  // Play sounds when FEN changes (opponent moves come via realtime)
  useEffect(() => {
    if (prevFenRef.current !== game.fen && !pendingPromotion) {
      // Detect what changed by replaying
      try {
        const tempGame = new Chess(prevFenRef.current);
        const nextGame = new Chess(game.fen);
        // Simple approach: if it's not our move that caused the change, play sound
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
        setMoveHistory(pgnGame.history());
        const verbose = pgnGame.history({ verbose: true });
        const last = verbose[verbose.length - 1];
        setLastMove(last ? { from: last.from, to: last.to } : null);
      } else {
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

  // Check if a move is a pawn promotion
  const isPromotionMove = useCallback((from: string, to: string): boolean => {
    const game2 = new Chess(fen);
    const piece = game2.get(from as any);
    if (!piece || piece.type !== "p") return false;
    const rank = to[1];
    return (piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1");
  }, [fen]);

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (isSpectator || !myTurn || gameEnded) return false;
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
    },
    [isSpectator, myTurn, gameEnded, fen, makeMove, isPromotionMove]
  );

  // Handle promotion selection
  const handlePromotionSelect = useCallback((piece: "q" | "r" | "b" | "n") => {
    if (pendingPromotion) {
      try {
        const tempGame = new Chess(fen);
        const move = tempGame.move({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece });
        if (move) {
          setFen(tempGame.fen());
          setMoveHistory(tempGame.history());
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

  // Play game start sound on mount
  useEffect(() => {
    playSound("gameStart");
  }, []);

  const renderPlayerBar = (data: { name: string; rating?: number | string | null; symbol: string; captured: string[]; advantage: number; clock: string; isActive: boolean }) => (
    <div className="flex items-center justify-between max-w-[600px] mx-auto w-full px-2">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
          <span className="text-base">{data.symbol}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium leading-tight">{data.name}</span>
          <div className="flex items-center gap-2">
            {data.rating && <span className="text-xs text-ccb-muted">{data.rating}</span>}
            <CapturedPieces pieces={data.captured} advantage={data.advantage} perspective="top" />
          </div>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-lg font-bold transition-colors ${
        data.isActive ? "bg-ccb-primary/15 text-ccb-primary" : "bg-ccb-surface text-ccb-muted"
      }`}>
        <Clock className="w-4 h-4" />
        {data.clock}
      </div>
    </div>
  );

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
        {renderPlayerBar(topPlayer)}
        <div className="w-full max-w-[600px] aspect-square mx-auto mt-1">
          <Chessboard options={{
            position: fen,
            boardOrientation: "white",
            onPieceDrop: () => false,
            allowDragging: false,
            squareStyles: squareStyles,
            darkSquareStyle: { backgroundColor: boardTheme.dark },
            lightSquareStyle: { backgroundColor: boardTheme.light },
            boardStyle: { borderRadius: "8px", overflow: "hidden" },
          }} />
        </div>
        {renderPlayerBar(bottomPlayer)}
      </div>
    );

    const sidebar = (
      <div className="flex flex-col gap-3">
        <div className="card flex items-center justify-between">
          <Link href="/play" className="text-sm text-ccb-muted hover:text-ccb-primary flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleSound} className="text-ccb-muted hover:text-ccb-primary transition-colors p-1">
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2 text-sm text-ccb-muted">
              <Eye className="w-4 h-4" />
              <span>Spectating</span>
            </div>
            <BoardThemePicker onThemeChange={setBoardTheme} />
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

      {renderPlayerBar(opponentData)}

      <div className="w-full max-w-[600px] aspect-square mx-auto mt-1">
        <Chessboard options={{
          position: fen,
          boardOrientation: isWhite ? "white" : "black",
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            return onDrop(sourceSquare, targetSquare);
          },
          allowDragging: myTurn && !gameEnded,
          squareStyles: squareStyles,
          darkSquareStyle: { backgroundColor: boardTheme.dark },
          lightSquareStyle: { backgroundColor: boardTheme.light },
          boardStyle: { borderRadius: "8px", overflow: "hidden" },
        }} />
      </div>

      {renderPlayerBar(playerData)}

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
        <div className="flex items-center gap-2">
          <button onClick={toggleSound} className="text-ccb-muted hover:text-ccb-primary transition-colors p-1">
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <BoardThemePicker onThemeChange={setBoardTheme} />
        </div>
      </div>
      <div className="card flex items-center justify-between">
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
      <PromotionDialog
        visible={!!pendingPromotion}
        color={isWhite ? "white" : "black"}
        onSelect={handlePromotionSelect}
        onCancel={() => setPendingPromotion(null)}
      />
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
