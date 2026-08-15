import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;

    // Fetch tournament
    const { data: tournament, error: tError } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();

    if (tError || !tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.status !== "upcoming") {
      return NextResponse.json({ error: "Tournament is not upcoming" }, { status: 400 });
    }

    // Fetch all participants
    const { data: participants, error: pError } = await supabase
      .from("tournament_participants")
      .select("player_id, score")
      .eq("tournament_id", tournamentId);

    if (pError) {
      return NextResponse.json({ error: pError.message }, { status: 500 });
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: "No participants to start" }, { status: 400 });
    }

    // Fetch ratings for seeding
    const playerIds = participants.map((p) => p.player_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, rating")
      .in("id", playerIds);

    const ratingMap = new Map((profiles || []).map((p) => [p.id, p.rating || 1200]));

    // Seed participants by rating (highest first)
    const seeded = participants
      .map((p) => ({
        ...p,
        rating: ratingMap.get(p.player_id) || 1200,
      }))
      .sort((a, b) => b.rating - a.rating);

    // Update seeds using admin client (bypasses RLS)
    const admin = createAdminClient();
    
    for (let i = 0; i < seeded.length; i++) {
      await admin
        .from("tournament_participants")
        .update({ seed: i + 1 })
        .eq("player_id", seeded[i].player_id)
        .eq("tournament_id", tournamentId);
    }

    // Generate Swiss pairings for Round 1
    // Simple Swiss: pair top half vs bottom half
    const pairings: Array<{
      white: string;
      black: string;
      bye?: string;
    }> = [];

    if (seeded.length === 1) {
      pairings.push({ white: "", black: "", bye: seeded[0].player_id });
    } else {
      const mid = Math.ceil(seeded.length / 2);
      const topHalf = seeded.slice(0, mid);
      const bottomHalf = seeded.slice(mid);

      for (let i = 0; i < mid; i++) {
        if (i < bottomHalf.length) {
          const white = i % 2 === 0 ? topHalf[i].player_id : bottomHalf[i].player_id;
          const black = i % 2 === 0 ? bottomHalf[i].player_id : topHalf[i].player_id;
          pairings.push({ white, black });
        } else {
          pairings.push({ white: "", black: "", bye: topHalf[i].player_id });
        }
      }
    }

    // Create tournament round entry (uses is_complete, not status)
    const { error: roundError } = await admin
      .from("tournament_rounds")
      .insert({
        tournament_id: tournamentId,
        round_number: 1,
        pairings: pairings.map((p, i) => ({
          board: i + 1,
          white: p.white || null,
          black: p.black || null,
          bye: p.bye || null,
          result: null,
        })),
        is_complete: false,
      });

    if (roundError) {
      console.error("Round creation error:", roundError);
      // Continue anyway — the tournament is started
    }

    // Create game entries for each pairing and award byes
    for (const pairing of pairings) {
      if (pairing.bye) {
        await admin
          .from("tournament_participants")
          .update({ wins: 1, score: 1, games_played: 1 })
          .eq("player_id", pairing.bye)
          .eq("tournament_id", tournamentId);
        continue;
      }

      await admin.from("games").insert({
        white_player_id: pairing.white,
        black_player_id: pairing.black,
        status: "playing",
        time_control: tournament.time_control,
        initial_minutes: tournament.initial_minutes,
        increment_seconds: tournament.increment_seconds,
        tournament_id: tournamentId,
        tournament_round: 1,
      });
    }

    // Update tournament status
    const { error: updateError } = await admin
      .from("tournaments")
      .update({ status: "active", current_round: 1 })
      .eq("id", tournamentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      pairings: pairings.length,
      round: 1,
    });
  } catch (e: any) {
    console.error("Start tournament error:", e);
    return NextResponse.json(
      { error: e.message || "Failed to start tournament" },
      { status: 500 }
    );
  }
}
