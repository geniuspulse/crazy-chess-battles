import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Bot user ID (chessbot@ccb.internal — created via admin API)
const BOT_USER_ID = "3699502b-57bf-498a-bc2d-11385fd9d317";

// Maps difficulty to time control classification
function classifyTimeControl(minutes: number): "bullet" | "blitz" | "rapid" | "classical" {
  if (minutes <= 2) return "bullet";
  if (minutes <= 5) return "blitz";
  if (minutes <= 15) return "rapid";
  return "classical";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      difficulty,    // "easy" | "medium" | "hard"
      playerColor,   // "white" | "black"
      status,        // "checkmate" | "stalemate" | "draw" | "resign" | "timeout"
      winner,        // "white" | "black" | null
      pgn,
      fen,
      moveCount,
      initialMinutes,
      incrementSeconds,
      whiteClockMs,
      blackClockMs,
    } = body;

    if (!userId || !difficulty || !playerColor || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get the player's current rating
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, rating")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Player profile not found" }, { status: 404 });
    }

    // Get the bot's rating
    const { data: botProfile } = await supabase
      .from("profiles")
      .select("id, rating")
      .eq("id", BOT_USER_ID)
      .single();

    const playerRating = profile.rating || 1500;
    const botRating = botProfile?.rating || 1500;

    // Bot games are unrated — no ELO change
    const whitePlayerId = playerColor === "white" ? userId : BOT_USER_ID;
    const blackPlayerId = playerColor === "white" ? BOT_USER_ID : userId;
    const whiteRating = playerColor === "white" ? playerRating : botRating;
    const blackRating = playerColor === "white" ? botRating : playerRating;

    const timeControl = classifyTimeControl(initialMinutes);

    // Determine ended_at
    const endedAt = new Date().toISOString();

    // Insert the game record
    const { data: game, error: insertError } = await supabase
      .from("games")
      .insert({
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId,
        white_rating: whiteRating,
        black_rating: blackRating,
        white_rating_change: 0, // Bot games are unrated
        black_rating_change: 0,
        time_control: timeControl,
        initial_minutes: initialMinutes,
        increment_seconds: incrementSeconds,
        status: status,
        winner: winner,
        pgn: pgn || null,
        fen: fen || null,
        move_count: moveCount || 0,
        rated: false, // Bot games are always unrated
        created_at: new Date(Date.now() - (moveCount || 0) * 3000).toISOString(), // Approximate start time
        ended_at: endedAt,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to save bot game:", insertError);
      return NextResponse.json({ error: "Failed to save game" }, { status: 500 });
    }

    return NextResponse.json({ success: true, gameId: game.id });
  } catch (err) {
    console.error("Save bot game error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
