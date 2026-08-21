"use client";

import { useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MoveScrollerProps {
  moves: string[]; // algebraic notation strings
  currentPly: number; // which move is "current" (0 = start, moves.length = latest)
  onPlyChange: (ply: number) => void;
}

// White pieces use outline/hollow unicode symbols, black pieces use filled symbols —
// matches chess.com's move list convention.
const WHITE_SYMBOLS: Record<string, string> = { N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔" };
const BLACK_SYMBOLS: Record<string, string> = { N: "♞", B: "♝", R: "♜", Q: "♛", K: "♚" };

/**
 * Converts SAN notation (e.g. "Nc6", "Qxd8+", "O-O") into chess.com-style
 * notation with a piece glyph instead of the letter. Pawn moves (e4, exd5)
 * and castling (O-O, O-O-O) are left as-is.
 */
function formatSAN(san: string, isWhiteMove: boolean): string {
  if (!san) return san;
  if (san.startsWith("O-O")) return san;
  const pieceLetter = san[0];
  const symbols = isWhiteMove ? WHITE_SYMBOLS : BLACK_SYMBOLS;
  if (symbols[pieceLetter]) {
    return symbols[pieceLetter] + san.slice(1);
  }
  return san; // pawn move
}

/**
 * Chess.com-style horizontal move list.
 * Shows move pairs in a horizontal strip with scroll buttons.
 * Clicking a move navigates the board to that position.
 */
export default function MoveScroller({ moves, currentPly, onPlyChange }: MoveScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pair moves into rows: [whiteMove, blackMove]
  const rows: { num: number; white?: string; black?: string; whitePly: number; blackPly?: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
      whitePly: i + 1,
      blackPly: i + 2,
    });
  }

  // Auto-scroll to current move
  useEffect(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const activeEl = container.querySelector('[data-ply="' + currentPly + '"]') as HTMLElement | null;
    if (activeEl) {
      const left = activeEl.offsetLeft - container.offsetWidth / 2 + activeEl.offsetWidth / 2;
      container.scrollTo({ left, behavior: "smooth" });
    } else {
      // Scroll to end
      container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
    }
  }, [currentPly, rows.length]);

  const scrollByPage = useCallback((dir: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 200, behavior: "smooth" });
  }, []);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-9 px-3 text-xs text-ccb-muted">
        No moves yet
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 select-none">
      {/* Back/forward nav buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => onPlyChange(Math.max(0, currentPly - 1))}
          disabled={currentPly <= 0}
          className="p-1 rounded text-ccb-muted hover:text-ccb-primary hover:bg-ccb-surface disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPlyChange(Math.min(moves.length, currentPly + 1))}
          disabled={currentPly >= moves.length}
          className="p-1 rounded text-ccb-muted hover:text-ccb-primary hover:bg-ccb-surface disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Horizontal move list */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-0.5 overflow-x-auto no-scrollbar min-w-0"
      >
        {rows.map((row) => (
          <div key={row.num} className="flex items-center gap-0.5 shrink-0">
            <span className="text-ccb-muted text-[10px] font-mono w-5 text-right shrink-0">{row.num}.</span>
            {row.white && (
              <button
                data-ply={row.whitePly}
                onClick={() => onPlyChange(row.whitePly)}
                className={`px-1.5 py-1 rounded text-xs font-mono transition-colors ${
                  currentPly === row.whitePly
                    ? "bg-ccb-primary text-white"
                    : "text-ccb-text hover:bg-ccb-surface"
                }`}
              >
                {formatSAN(row.white, true)}
              </button>
            )}
            {row.black && (
              <button
                data-ply={row.blackPly ?? 0}
                onClick={() => onPlyChange(row.blackPly!)}
                className={`px-1.5 py-1 rounded text-xs font-mono transition-colors ${
                  currentPly === row.blackPly
                    ? "bg-ccb-primary text-white"
                    : "text-ccb-text hover:bg-ccb-surface"
                }`}
              >
                {formatSAN(row.black, false)}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Scroll buttons for long lists */}
      {rows.length > 8 && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => scrollByPage(-1)}
            className="p-1 rounded text-ccb-muted hover:text-ccb-primary hover:bg-ccb-surface transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={() => scrollByPage(1)}
            className="p-1 rounded text-ccb-muted hover:text-ccb-primary hover:bg-ccb-surface transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
