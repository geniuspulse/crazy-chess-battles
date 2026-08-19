import { Chess } from "chess.js";

const PIECE_SYMBOLS: Record<string, string> = {
  wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕",
  bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛",
};

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export function getCapturedPieces(fen: string): { white: string[]; black: string[]; advantage: number } {
  const startCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const game = new Chess(fen);
  const board = game.board();
  const whiteCounts: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const blackCounts: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };

  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      if (piece.color === "w") whiteCounts[piece.type]++;
      else blackCounts[piece.type]++;
    }
  }

  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];

  for (const type of ["q", "r", "b", "n", "p"]) {
    const missingBlack = startCounts[type] - blackCounts[type];
    for (let i = 0; i < missingBlack; i++) whiteCaptured.push(PIECE_SYMBOLS["b" + type]);
    const missingWhite = startCounts[type] - whiteCounts[type];
    for (let i = 0; i < missingWhite; i++) blackCaptured.push(PIECE_SYMBOLS["w" + type]);
  }

  let whiteMaterial = 0, blackMaterial = 0;
  for (const [type, count] of Object.entries(whiteCounts)) {
    whiteMaterial += (PIECE_VALUES[type] || 0) * count;
  }
  for (const [type, count] of Object.entries(blackCounts)) {
    blackMaterial += (PIECE_VALUES[type] || 0) * count;
  }

  return {
    white: whiteCaptured,
    black: blackCaptured,
    advantage: whiteMaterial - blackMaterial,
  };
}

export function getLastMoveSquares(history: { from: string; to: string }[] | string[]): { from: string; to: string } | null {
  if (Array.isArray(history) && history.length === 0) return null;
  if (typeof history[0] === "string") {
    try {
      const game = new Chess();
      for (const m of history as string[]) game.move(m);
      const verbose = game.history({ verbose: true });
      const last = verbose[verbose.length - 1];
      return last ? { from: last.from, to: last.to } : null;
    } catch { return null; }
  }
  const arr = history as { from: string; to: string }[];
  const last = arr[arr.length - 1];
  return last || null;
}

export function getCheckSquare(fen: string): string | null {
  try {
    const game = new Chess(fen);
    if (!game.inCheck()) return null;
    const turn = game.turn();
    const board = game.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type === "k" && piece.color === turn) {
          return String.fromCharCode(97 + file) + (rank + 1);
        }
      }
    }
  } catch {}
  return null;
}
