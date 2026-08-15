import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { timeControl, rated } = await req.json();

    if (!timeControl) {
      return NextResponse.json({ error: "Time control required" }, { status: 400 });
    }

    // Get player's rating
    const { data: profile } = await supabase
      .from("profiles")
      .select("rating")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Remove any existing queue entry for this player
    await supabase
      .from("matchmaking_queue")
      .delete()
      .eq("player_id", user.id);

    // Add to queue
    const { error } = await supabase
      .from("matchmaking_queue")
      .insert({
        player_id: user.id,
        time_control: timeControl,
        rated: rated ?? true,
        rating: profile.rating,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Try to find an immediate match
    const { data: opponents } = await supabase
      .from("matchmaking_queue")
      .select("id, player_id, rating, time_control, rated, joined_at")
      .neq("player_id", user.id)
      .eq("time_control", timeControl)
      .eq("rated", rated ?? true)
      .order("joined_at", { ascending: true })
      .limit(10);

    if (opponents && opponents.length > 0) {
      // Find closest rating opponent
      const myRating = profile.rating;
      const opponent = opponents.reduce((closest, p) => {
        const diff = Math.abs(p.rating - myRating);
        const closestDiff = Math.abs(closest.rating - myRating);
        return diff < closestDiff ? p : closest;
      });

      // Time control configs
      const tcConfig: Record<string, { minutes: number; increment: number }> = {
        bullet: { minutes: 1, increment: 0 },
        blitz: { minutes: 5, increment: 0 },
        blitz3: { minutes: 3, increment: 2 },
        rapid: { minutes: 10, increment: 0 },
        rapid15: { minutes: 15, increment: 10 },
        classical: { minutes: 30, increment: 0 },
      };

      const tc = tcConfig[timeControl] || tcConfig.blitz;

      // Create the game
      const { data: gameId, error: gameError } = await supabase.rpc("create_game", {
        p_white_id: user.id,
        p_black_id: opponent.player_id,
        p_white_rating: myRating,
        p_black_rating: opponent.rating,
        p_time_control: timeControl,
        p_initial_minutes: tc.minutes,
        p_increment_seconds: tc.increment,
        p_rated: rated ?? true,
      });

      if (gameError || !gameId) {
        return NextResponse.json({ status: "searching" });
      }

      // Remove both players from queue
      await supabase.from("matchmaking_queue").delete().eq("player_id", user.id);
      await supabase.from("matchmaking_queue").delete().eq("id", opponent.id);

      return NextResponse.json({
        status: "matched",
        gameId,
        opponent: { rating: opponent.rating },
        color: "white",
      });
    }

    return NextResponse.json({ status: "searching" });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to join matchmaking" },
      { status: 500 }
    );
  }
}
