"use client";

import { useEffect, useRef } from "react";

interface MoveHistoryProps {
  moves: string[]; // algebraic notation strings e.g. ["e4", "e5", "Nf3"]
  max?: number;
}

export default function MoveHistory({ moves }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length]);

  // Pair moves into rows: [whiteMove, blackMove]
  const rows: { num: number; white?: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="card flex flex-col h-full">
      <h3 className="text-sm font-medium text-ccb-muted mb-3 flex items-center gap-2 shrink-0">
        <span className="w-2 h-2 rounded-full bg-ccb-primary"></span>
        Moves
      </h3>
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 max-h-[300px] lg:max-h-[400px] no-scrollbar">
        {rows.length === 0 ? (
          <p className="text-xs text-ccb-muted text-center py-4">No moves yet</p>
        ) : (
          <div className="space-y-0.5">
            {rows.map((row) => (
              <div
                key={row.num}
                className="flex items-center gap-2 text-sm rounded-md hover:bg-ccb-surface/50 px-1 py-0.5"
              >
                <span className="text-ccb-muted text-xs font-mono w-6 text-right shrink-0">{row.num}.</span>
                <span className="font-mono text-ccb-text flex-1">{row.white || ""}</span>
                <span className="font-mono text-ccb-text flex-1">{row.black || ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
