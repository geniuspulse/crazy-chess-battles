"use client";

import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { detectOpening } from "@/lib/game/openings";

interface OpeningBadgeProps {
  moves: string[];
}

export default function OpeningBadge({ moves }: OpeningBadgeProps) {
  const opening = useMemo(() => detectOpening(moves), [moves]);

  if (!opening || moves.length < 2) return null;

  return (
    <div className="card flex items-center gap-2 px-3 py-2">
      <BookOpen className="w-3.5 h-3.5 text-ccb-primary shrink-0" />
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-mono text-ccb-muted shrink-0">{opening.eco}</span>
        <span className="text-xs text-ccb-foreground truncate">{opening.name}</span>
      </div>
    </div>
  );
}
