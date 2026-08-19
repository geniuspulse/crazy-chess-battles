"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
  y: number;
}

const REACTIONS = ["👍", "🔥", "💀", "👏", "😂", "🤝", "🤯", "💪"];

interface QuickReactionsProps {
  onReact?: (emoji: string) => void;
  position?: "bottom" | "side";
}

export default function QuickReactions({ onReact, position = "bottom" }: QuickReactionsProps) {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const idRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const sendReaction = useCallback((emoji: string) => {
    const id = idRef.current++;
    const x = position === "bottom" ? Math.random() * 40 + 30 : 50;
    const y = position === "bottom" ? 100 : 50;
    setFloating((prev) => [...prev, { id, emoji, x, y }]);
    onReact?.(emoji);

    // Remove after animation
    setTimeout(() => {
      setFloating((prev) => prev.filter((f) => f.id !== id));
    }, 2000);
  }, [onReact, position]);

  if (position === "side") {
    return (
      <div ref={containerRef} className="relative">
        {/* Floating reactions */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {floating.map((f) => (
            <div
              key={f.id}
              className="absolute text-2xl"
              style={{
                left: `${f.x}%`,
                bottom: "0%",
                animation: "float-up 2s ease-out forwards",
              }}
            >
              {f.emoji}
            </div>
          ))}
        </div>

        {/* Picker */}
        {showPicker && (
          <div className="card p-2 flex gap-1 mb-2 animate-slide-up">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-xl p-1.5 rounded-lg hover:bg-ccb-surface transition-colors hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowPicker(!showPicker)}
          className="btn-secondary text-sm w-full"
        >
          😊 React
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Floating reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ height: "200px" }}>
        {floating.map((f) => (
          <div
            key={f.id}
            className="absolute text-3xl"
            style={{
              left: `${f.x}%`,
              bottom: "0%",
              animation: "float-up 2s ease-out forwards",
            }}
          >
            {f.emoji}
          </div>
        ))}
      </div>

      {/* Reaction bar */}
      <div className="flex items-center justify-center gap-1 max-w-[600px] mx-auto">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-xl p-1.5 rounded-lg hover:bg-ccb-surface transition-all hover:scale-125 active:scale-90"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
