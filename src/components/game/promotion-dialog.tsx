"use client";

import { useState, useEffect } from "react";

interface PromotionDialogProps {
  visible: boolean;
  color: "white" | "black";
  onSelect: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}

const PIECE_UNICODE: Record<string, { white: string; black: string; label: string }> = {
  q: { white: "♕", black: "♛", label: "Queen" },
  r: { white: "♖", black: "♜", label: "Rook" },
  b: { white: "♗", black: "♝", label: "Bishop" },
  n: { white: "♘", black: "♞", label: "Knight" },
};

export default function PromotionDialog({ visible, color, onSelect, onCancel }: PromotionDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }
    setMounted(false);
  }, [visible]);

  if (!visible) return null;

  const pieces: ("q" | "r" | "b" | "n")[] = ["q", "r", "b", "n"];
  const symbolColor = color === "white" ? "white" : "black";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(6, 6, 12, 0.7)", backdropFilter: "blur(3px)" }}
      onClick={onCancel}
    >
      <div
        className={`card max-w-xs w-[90%] p-6 transition-all duration-200 ${
          mounted ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center text-sm font-medium text-ccb-muted mb-4">
          Promote to:
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {pieces.map((piece) => (
            <button
              key={piece}
              onClick={() => onSelect(piece)}
              className="flex flex-col items-center gap-1 rounded-lg bg-ccb-surface border border-ccb-border p-3 hover:border-ccb-primary hover:bg-ccb-primary/10 transition-all hover:scale-105"
            >
              <span
                className="text-4xl leading-none"
                style={{
                  color: symbolColor === "white" ? "#f8fafc" : "#1a1a2e",
                  textShadow: symbolColor === "white" ? "0 1px 3px rgba(0,0,0,0.4)" : "0 1px 3px rgba(255,255,255,0.15)",
                }}
              >
                {PIECE_UNICODE[piece][symbolColor]}
              </span>
              <span className="text-xs text-ccb-muted">{PIECE_UNICODE[piece].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
