import { Chess } from "chess.js";

export interface GameMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface MoveResult {
  valid: boolean;
  fen?: string;
  pgn?: string;
  status?: string;
  winner?: string | null;
  moveCount?: number;
  turn?: "white" | "black";
  whiteClockMs?: number;
  blackClockMs?: number;
  error?: string;
}

export function validateAndApplyMove(
  currentFen: string,
  move: GameMove,
  currentPgn: string,
  whiteClockMs: number,
  blackClockMs: number,
  lastMoveAt: string,
  turn: "white" | "black",
  incrementSeconds: number
): MoveResult {
  try {
    const game = new Chess(currentFen);

    // Validate it's the right player's turn
    const isWhiteTurn = turn === "white";
    if (game.turn() !== (isWhiteTurn ? "w" : "b")) {
      return { valid: false, error: "Not your turn" };
    }

    // Apply the move
    const result = game.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion || "q",
    });

    if (result === null) {
      return { valid: false, error: "Illegal move" };
    }

    // Calculate clock
    const now = Date.now();
    const lastMoveTime = new Date(lastMoveAt).getTime();
    const elapsedMs = Math.max(0, now - lastMoveTime);

    let newWhiteClock = whiteClockMs;
    let newBlackClock = blackClockMs;

    if (isWhiteTurn) {
      newWhiteClock = whiteClockMs - elapsedMs + incrementSeconds * 1000;
    } else {
      newBlackClock = blackClockMs - elapsedMs + incrementSeconds * 1000;
    }

    // Check for timeout
    if (newWhiteClock <= 0) {
      return {
        valid: true,
        fen: game.fen(),
        pgn: game.pgn(),
        status: "timeout",
        winner: "black",
        moveCount: game.history().length,
        turn: "black",
        whiteClockMs: 0,
        blackClockMs: newBlackClock,
      };
    }
    if (newBlackClock <= 0) {
      return {
        valid: true,
        fen: game.fen(),
        pgn: game.pgn(),
        status: "timeout",
        winner: "white",
        moveCount: game.history().length,
        turn: "white",
        whiteClockMs: newWhiteClock,
        blackClockMs: 0,
      };
    }

    // Determine game status
    let status = "playing";
    let winner: string | null = null;

    if (game.isCheckmate()) {
      status = "checkmate";
      winner = isWhiteTurn ? "white" : "black";
    } else if (game.isStalemate()) {
      status = "stalemate";
    } else if (game.isDraw()) {
      status = "draw";
    } else if (game.isThreefoldRepetition()) {
      status = "draw";
    } else if (game.isInsufficientMaterial()) {
      status = "draw";
    }

    const newTurn = game.turn() === "w" ? "white" : "black";

    return {
      valid: true,
      fen: game.fen(),
      pgn: game.pgn(),
      status,
      winner,
      moveCount: game.history().length,
      turn: newTurn,
      whiteClockMs: Math.max(0, Math.floor(newWhiteClock)),
      blackClockMs: Math.max(0, Math.floor(newBlackClock)),
    };
  } catch (e) {
    return { valid: false, error: "Invalid move" };
  }
}
