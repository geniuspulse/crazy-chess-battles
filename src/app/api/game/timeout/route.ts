import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTimeoutForGame } from "@/lib/game/resolve-timeout";

// Cron sweep — checks ALL active games for expired clocks. This is a
// backup safety net in case neither player's client is connected to poll
// timeout-check (e.g. both tabs closed). Requires CRON_SECRET.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: activeGames } = await admin
      .from("games")
      .select("id, turn, move_count, white_clock_ms, black_clock_ms, last_move_at, created_at, white_player_id, black_player_id, white_rating, black_rating, rated, tournament_id")
      .eq("status", "playing");

    if (!activeGames || activeGames.length === 0) {
      return NextResponse.json({ checked: 0, timedOut: 0 });
    }

    const now = Date.now();
    let timedOut = 0;

    for (const game of activeGames) {
      const lastMoveTime = new Date(game.last_move_at || game.created_at).getTime();
      const elapsedMs = now - lastMoveTime;
      const currentClockMs = game.turn === "white" ? game.white_clock_ms : game.black_clock_ms;
      const remainingMs = (currentClockMs ?? 0) - elapsedMs;

      if (remainingMs <= 0) {
        await resolveTimeoutForGame(admin, game);
        timedOut++;
      }
    }

    return NextResponse.json({ checked: activeGames.length, timedOut });
  } catch (e: any) {
    console.error("Timeout check error:", e);
    return NextResponse.json({ error: "Timeout check failed" }, { status: 500 });
  }
}
