import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTimeoutForGame } from "@/lib/game/resolve-timeout";

// Client-callable timeout check — verifies the current user is in the game.
// Polled every few seconds by both players' clients while a game is in
// progress, so whichever side is still connected can detect and resolve
// an opponent's expired clock (no-show -> abort, mid-game disconnect -> timeout loss).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await req.json();
    if (!gameId) {
      return NextResponse.json({ error: "Game ID required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: game } = await admin
      .from("games")
      .select("id, status, turn, move_count, white_clock_ms, black_clock_ms, last_move_at, created_at, white_player_id, black_player_id, white_rating, black_rating, rated, tournament_id")
      .eq("id", gameId)
      .single();

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.white_player_id !== user.id && game.black_player_id !== user.id) {
      return NextResponse.json({ error: "Not a player in this game" }, { status: 403 });
    }

    if (game.status !== "playing") {
      return NextResponse.json({ status: game.status, timedOut: false });
    }

    const now = Date.now();
    const lastMoveTime = new Date(game.last_move_at || game.created_at).getTime();
    const elapsedMs = now - lastMoveTime;
    const currentClockMs = game.turn === "white" ? game.white_clock_ms : game.black_clock_ms;
    const remainingMs = (currentClockMs ?? 0) - elapsedMs;

    if (remainingMs <= 0) {
      const result = await resolveTimeoutForGame(admin, game);
      return NextResponse.json({ timedOut: true, status: result.status, winner: result.winner });
    }

    return NextResponse.json({ timedOut: false, status: "playing" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Timeout check failed" }, { status: 500 });
  }
}
