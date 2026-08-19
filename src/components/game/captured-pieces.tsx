"use client";

interface CapturedPiecesProps {
  pieces: string[]; // unicode symbols
  advantage: number; // positive = this player ahead, negative = behind
  perspective: "top" | "bottom"; // top = opponent, bottom = you
}

export default function CapturedPieces({ pieces, advantage }: CapturedPiecesProps) {
  const sortedPieces = [...pieces].sort((a, b) => {
    const order: Record<string, number> = { "♕": 5, "♛": 5, "♖": 4, "♜": 4, "♗": 3, "♝": 3, "♘": 2, "♞": 2, "♙": 1, "♟": 1 };
    return (order[b] || 0) - (order[a] || 0);
  });

  const showAdvantage = advantage > 0;

  return (
    <div className="flex items-center gap-1 min-h-[20px]">
      <span className="text-sm leading-none flex flex-wrap gap-0.5">
        {sortedPieces.map((p, i) => (
          <span key={i} className="text-ccb-muted" style={{ fontSize: "14px", lineHeight: 1 }}>
            {p}
          </span>
        ))}
      </span>
      {showAdvantage && (
        <span className="text-xs font-bold text-ccb-success ml-1">
          +{advantage}
        </span>
      )}
    </div>
  );
}
