import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Client-callable timeout check — verifies the current user is in the game
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
      .select("id, status, turn, white_clock_ms, black_clock_ms, last_move_at, created_at, white_player_id, black_player_id, white_rating, black_rating, rated")
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
      const loser = game.turn;
      const winner = loser === "white" ? "black" : "white";
      const loserId = loser === "white" ? game.white_player_id : game.black_player_id;
      const winnerId = loser === "white" ? game.black_player_id : game.white_player_id;
      const loserRating = loser === "white" ? game.white_rating : game.black_rating;
      const winnerRating = loser === "white" ? game.black_rating : game.white_rating;

      await admin.from("games").update({
        status: "timeout",
        winner: winner,
        ended_at: new Date().toISOString(),
        [`${loser}_clock_ms`]: 0,
      }).eq("id", gameId);

      if (game.rated && loserRating && winnerRating) {
        const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
        const K = 32;
        const winnerChange = Math.round(K * (1 - expectedWinner));
        const loserChange = -winnerChange;

        await admin.from("games").update({
          white_rating_change: loser === "white" ? loserChange : winnerChange,
          black_rating_change: loser === "black" ? loserChange : winnerChange,
        }).eq("id", gameId);

        const { data: winnerProfile } = await admin.from("profiles").select("wins, games_played, rating").eq("id", winnerId).single();
        const { data: loserProfile } = await admin.from("profiles").select("losses, games_played, rating").eq("id", loserId).single();

        if (winnerProfile) {
          await admin.from("profiles").update({
            rating: winnerRating + winnerChange,
            wins: (winnerProfile.wins ?? 0) + 1,
            games_played: (winnerProfile.games_played ?? 0) + 1,
          }).eq("id", winnerId);
        }

        if (loserProfile) {
          await admin.from("profiles").update({
            rating: loserRating + loserChange,
            losses: (loserProfile.losses ?? 0) + 1,
            games_played: (loserProfile.games_played ?? 0) + 1,
          }).eq("id", loserId);
        }
      }

      return NextResponse.json({ timedOut: true, status: "timeout", winner });
    }

    return NextResponse.json({ timedOut: false, status: "playing" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Timeout check failed" }, { status: 500 });
  }
}
