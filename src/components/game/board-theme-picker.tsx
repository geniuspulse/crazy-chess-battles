"use client";

import { useState, useRef, useEffect } from "react";
import { Palette, Check } from "lucide-react";
import { BOARD_THEMES, getStoredBoardTheme, storeBoardTheme, type BoardTheme } from "@/lib/game/board-themes";

interface BoardThemePickerProps {
  onThemeChange: (theme: BoardTheme) => void;
}

export default function BoardThemePicker({ onThemeChange }: BoardThemePickerProps) {
  const [current, setCurrent] = useState<BoardTheme>(BOARD_THEMES[0]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = getStoredBoardTheme();
    setCurrent(stored);
    onThemeChange(stored);
  }, [onThemeChange]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (theme: BoardTheme) => {
    setCurrent(theme);
    storeBoardTheme(theme.id);
    onThemeChange(theme);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-secondary text-sm flex items-center gap-2"
      >
        <Palette className="w-4 h-4" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: current.light, border: "1px solid rgba(255,255,255,0.2)" }} />
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: current.dark }} />
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 card p-2 min-w-[160px] shadow-xl">
          <div className="text-xs text-ccb-muted mb-2 px-1">Board Theme</div>
          <div className="space-y-1">
            {BOARD_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-ccb-surface transition-colors"
              >
                <span className="text-sm">{theme.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="flex">
                    <span className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.light, border: "1px solid rgba(255,255,255,0.15)" }} />
                    <span className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.dark }} />
                  </span>
                  {current.id === theme.id && <Check className="w-3.5 h-3.5 text-ccb-primary" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
