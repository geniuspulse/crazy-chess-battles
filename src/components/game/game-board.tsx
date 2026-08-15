"use client";

import { useState, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

export default function GameBoard({ fen }: { fen?: string }) {
  const [game, setGame] = useState(new Chess(fen));
  const [moveList, setMoveList] = useState<string[]>([]);

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (move === null) return false;

      setGame(new Chess(game.fen()));
      setMoveList([...moveList, move.san]);
      return true;
    } catch {
      return false;
    }
  }, [game, moveList]);

  return (
    <div className="flex flex-col gap-4">
      {/* Chessboard */}
      <div className="w-full max-w-[600px] aspect-square mx-auto">
        <Chessboard
          position={game.fen()}
          onPieceDrop={onDrop}
          boardWidth={600}
          customDarkSquareStyle={{ backgroundColor: "#312e81" }}
          customLightSquareStyle={{ backgroundColor: "#e0e7ff" }}
          customBoardStyle={{ borderRadius: "8px", overflow: "hidden" }}
        />
      </div>

      {/* Move list */}
      {moveList.length > 0 && (
        <div className="card max-w-[600px] mx-auto w-full">
          <h4 className="text-sm font-medium mb-2">Moves</h4>
          <div className="flex flex-wrap gap-2 text-sm font-mono">
            {moveList.map((move, idx) => (
              <span key={idx} className="text-ccb-muted">
                {idx % 2 === 0 && <span className="text-ccb-muted">{Math.floor(idx / 2) + 1}.</span>} {move}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
