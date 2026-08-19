import { Chess } from "chess.js";

// Piece values for material evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Piece-square tables (from white's perspective)
const PAWN_TABLE = [
  0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
  5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
  5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0,
];
const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40,
  -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
  -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
  -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50,
];
const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10,
  -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
  -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
  -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20,
];
const ROOK_TABLE = [
  0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5,
  -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
  -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0,
];
const QUEEN_TABLE = [
  -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10,
  -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
  0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10,
  -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20,
];
const KING_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
  20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20,
];
const PIECE_TABLES: Record<string, number[]> = {
  p: PAWN_TABLE, n: KNIGHT_TABLE, b: BISHOP_TABLE, r: ROOK_TABLE, q: QUEEN_TABLE, k: KING_TABLE,
};

function squareToIndex(square: string): number {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  return rank * 8 + file;
}

function evaluateBoard(game: Chess): number {
  if (game.isCheckmate()) return game.turn() === "w" ? -100000 : 100000;
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) return 0;
  let score = 0;
  const board = game.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;
      const sq = String.fromCharCode(97 + file) + (rank + 1);
      const idx = squareToIndex(sq);
      const val = PIECE_VALUES[piece.type] || 0;
      const table = PIECE_TABLES[piece.type];
      const tv = table ? (piece.color === "w" ? table[idx] : table[63 - idx]) : 0;
      score += piece.color === "w" ? val + tv : -(val + tv);
    }
  }
  return score;
}

function minimax(game: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0 || game.isGameOver()) return evaluateBoard(game);
  const moves = game.moves({ verbose: true });
  moves.sort((a, b) => (b.captured ? PIECE_VALUES[b.captured] || 0 : 0) - (a.captured ? PIECE_VALUES[a.captured] || 0 : 0));
  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const e = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      maxEval = Math.max(maxEval, e);
      alpha = Math.max(alpha, e);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const e = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      minEval = Math.min(minEval, e);
      beta = Math.min(beta, e);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export type AIDifficulty = "easy" | "medium" | "hard";
const DIFFICULTY_DEPTH: Record<AIDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

export function getBestMove(fen: string, difficulty: AIDifficulty = "medium"): { from: string; to: string; promotion?: string } | null {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;
  const depth = DIFFICULTY_DEPTH[difficulty];
  const isWhite = game.turn() === "w";

  if (difficulty === "easy" && Math.random() < 0.3) {
    const r = moves[Math.floor(Math.random() * moves.length)];
    return { from: r.from, to: r.to, promotion: r.promotion || "q" };
  }

  let bestMove = moves[0];
  let bestScore = isWhite ? -Infinity : Infinity;
  moves.sort((a, b) => (b.captured ? PIECE_VALUES[b.captured] || 0 : 0) - (a.captured ? PIECE_VALUES[a.captured] || 0 : 0));
  for (const move of moves) {
    game.move(move);
    const score = minimax(game, depth - 1, -Infinity, Infinity, !isWhite);
    game.undo();
    if (isWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion || "q" };
}
