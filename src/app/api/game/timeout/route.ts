import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Find all active games
    const { data: activeGames } = await admin
      .from("games")
      .select("id, turn, white_clock_ms, black_clock_ms, last_move_at, created_at, white_player_id, black_player_id, white_rating, black_rating, rated")
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
        const loser = game.turn;
        const winner = loser === "white" ? "black" : "white";
        const loserId = loser === "white" ? game.white_player_id : game.black_player_id;
        const winnerId = loser === "white" ? game.black_player_id : game.white_player_id;
        const loserRating = loser === "white" ? game.white_rating : game.black_rating;
        const winnerRating = loser === "white" ? game.black_rating : game.white_rating;

        // Update game status
        await admin
          .from("games")
          .update({
            status: "timeout",
            winner: winner,
            ended_at: new Date().toISOString(),
            [`${loser}_clock_ms`]: 0,
          })
          .eq("id", game.id);

        // Update ratings if rated
        if (game.rated && loserRating && winnerRating) {
          const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
          const K = 32;
          const winnerChange = Math.round(K * (1 - expectedWinner));
          const loserChange = -winnerChange;

          await admin
            .from("games")
            .update({
              white_rating_change: loser === "white" ? loserChange : winnerChange,
              black_rating_change: loser === "black" ? loserChange : winnerChange,
            })
            .eq("id", game.id);

          // Fetch current stats for both players
          const { data: winnerProfile } = await admin.from("profiles").select("wins, games_played").eq("id", winnerId).single();
          const { data: loserProfile } = await admin.from("profiles").select("losses, games_played").eq("id", loserId).single();

          await admin
            .from("profiles")
            .update({
              rating: winnerRating + winnerChange,
              wins: (winnerProfile?.wins ?? 0) + 1,
              games_played: (winnerProfile?.games_played ?? 0) + 1,
            })
            .eq("id", winnerId);

          await admin
            .from("profiles")
            .update({
              rating: loserRating + loserChange,
              losses: (loserProfile?.losses ?? 0) + 1,
              games_played: (loserProfile?.games_played ?? 0) + 1,
            })
            .eq("id", loserId);
        }

        timedOut++;
      }
    }

    return NextResponse.json({ checked: activeGames.length, timedOut });
  } catch (e: any) {
    console.error("Timeout check error:", e);
    return NextResponse.json({ error: "Timeout check failed" }, { status: 500 });
  }
}
