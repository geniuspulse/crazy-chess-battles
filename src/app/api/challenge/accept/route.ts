import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challengeId } = await req.json();

    if (!challengeId) {
      return NextResponse.json({ error: "Challenge ID required" }, { status: 400 });
    }

    // Fetch the challenge
    const { data: challenge, error } = await supabase
      .from("challenges")
      .select("*")
      .eq("id", challengeId)
      .single();

    if (error || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (challenge.status !== "pending") {
      return NextResponse.json({ error: "Challenge is no longer available" }, { status: 400 });
    }

    if (challenge.challenger_id === user.id) {
      return NextResponse.json({ error: "You cannot accept your own challenge" }, { status: 400 });
    }

    // Check expiry
    if (new Date(challenge.expires_at) < new Date()) {
      await supabase.from("challenges").update({ status: "expired" }).eq("id", challengeId);
      return NextResponse.json({ error: "Challenge has expired" }, { status: 400 });
    }

    // Determine colors
    let whitePlayer = challenge.challenger_id;
    let blackPlayer = user.id;

    if (challenge.color === "black") {
      whitePlayer = user.id;
      blackPlayer = challenge.challenger_id;
    } else if (challenge.color === "random") {
      // Random color assignment
      if (Math.random() > 0.5) {
        whitePlayer = user.id;
        blackPlayer = challenge.challenger_id;
      }
    }

    // Create the game using admin client (bypasses RLS for cross-user game creation)
    const admin = createAdminClient();
    const { data: game, error: gameError } = await admin
      .from("games")
      .insert({
        white_player_id: whitePlayer,
        black_player_id: blackPlayer,
        status: "playing",
        time_control: challenge.time_control,
        initial_minutes: challenge.initial_minutes,
        increment_seconds: challenge.increment_seconds,
        white_clock_ms: challenge.initial_minutes * 60 * 1000,
        black_clock_ms: challenge.initial_minutes * 60 * 1000,
        last_move_at: new Date().toISOString(),
        is_rated: challenge.rated,
      })
      .select("id")
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
    }

    // Update challenge with accepted status + game link
    await admin
      .from("challenges")
      .update({ status: "accepted", acceptor_id: user.id, game_id: game.id })
      .eq("id", challengeId);

    return NextResponse.json({ gameId: game.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
