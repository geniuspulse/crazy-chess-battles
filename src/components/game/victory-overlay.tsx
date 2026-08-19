"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Handshake, Frown, RefreshCw, Home, Swords } from "lucide-react";
import FireworksCanvas from "./fireworks-canvas";

export type GameOutcome = "win" | "loss" | "draw";

interface VictoryOverlayProps {
  visible: boolean;
  outcome: GameOutcome;
  reasonLabel: string; // "Checkmate", "Resignation", "Time out", "Stalemate", "Draw"
  ratingChange?: number | null;
  moveCount: number;
  subtitle: string; // e.g. "Medium Bot · vs Computer" or "5+0 · Ranked"
  onNewGame?: () => void;
  newGameLabel?: string;
  lobbyHref?: string;
}

export default function VictoryOverlay({
  visible,
  outcome,
  reasonLabel,
  ratingChange,
  moveCount,
  subtitle,
  onNewGame,
  newGameLabel = "New Game",
  lobbyHref = "/play",
}: VictoryOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      // trigger enter animation on next tick
      const t = setTimeout(() => setMounted(true), 20);
      return () => clearTimeout(t);
    }
    setMounted(false);
  }, [visible]);

  if (!visible) return null;

  const isWin = outcome === "win";
  const isDraw = outcome === "draw";
  const isLoss = outcome === "loss";

  const headline = isWin ? "Victory!" : isDraw ? "Draw" : "Defeat";
  const message = isWin ? "You won" : isDraw ? "Game drawn" : "You lost";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(6, 6, 12, 0.72)", backdropFilter: "blur(4px)" }}
    >
      {/* Fireworks layer */}
      {(isWin || isDraw) && (
        <FireworksCanvas active={mounted} colorTheme={isWin ? "win" : "draw"} />
      )}

      {/* Card */}
      <div
        className={`relative w-[90%] max-w-sm rounded-2xl border p-6 sm:p-8 text-center shadow-2xl transition-all duration-500 ease-out ${
          mounted ? "translate-y-0 scale-100 opacity-100" : "-translate-y-10 scale-90 opacity-0"
        } ${
          isWin
            ? "bg-gradient-to-b from-ccb-primary/20 to-ccb-card border-ccb-primary/40"
            : isDraw
            ? "bg-ccb-card border-ccb-border"
            : "bg-gradient-to-b from-ccb-danger/10 to-ccb-card border-ccb-danger/30"
        }`}
      >
        {/* Icon badge */}
        <div
          className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${
            isWin
              ? "bg-ccb-primary/15 animate-pulse-glow"
              : isDraw
              ? "bg-ccb-surface"
              : "bg-ccb-danger/10"
          }`}
        >
          {isWin && <Trophy className="h-10 w-10 text-ccb-primary" />}
          {isDraw && <Handshake className="h-10 w-10 text-ccb-muted" />}
          {isLoss && <Frown className="h-10 w-10 text-ccb-danger" />}
        </div>

        <h2
          className={`text-3xl font-extrabold tracking-tight mb-1 ${
            isWin ? "text-ccb-primary" : isDraw ? "text-ccb-text" : "text-ccb-danger"
          }`}
        >
          {headline}
        </h2>
        <p className="text-sm text-ccb-muted mb-1">{reasonLabel}</p>
        <p className="text-base font-medium mb-4">{message}</p>

        {ratingChange !== null && ratingChange !== undefined && (
          <div
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold mb-4 ${
              ratingChange >= 0
                ? "bg-ccb-success/10 text-ccb-success"
                : "bg-ccb-danger/10 text-ccb-danger"
            }`}
          >
            {ratingChange >= 0 ? "+" : ""}
            {ratingChange} rating
          </div>
        )}

        <div className="text-xs text-ccb-muted mb-6">
          Move {moveCount} · {subtitle}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {onNewGame && (
            <button
              onClick={onNewGame}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> {newGameLabel}
            </button>
          )}
          <Link
            href={lobbyHref}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            {onNewGame ? <Home className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
            {onNewGame ? "Lobby" : "Play Again"}
          </Link>
        </div>
      </div>
    </div>
  );
}
