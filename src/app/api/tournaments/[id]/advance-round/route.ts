import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const { id: tournamentId } = await params;
    const admin = createAdminClient();

    const { data: tournament } = await admin
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.status !== "active") {
      return NextResponse.json({ error: "Tournament not active" }, { status: 400 });
    }

    const nextRound = (tournament.current_round || 1) + 1;

    if (nextRound > tournament.rounds) {
      // All rounds done — finish tournament
      await admin
        .from("tournaments")
        .update({ status: "finished", ended_at: new Date().toISOString() })
        .eq("id", tournamentId);

      return NextResponse.json({ success: true, finished: true });
    }

    // Check if current round is complete
    const { data: currentRound } = await admin
      .from("tournament_rounds")
      .select("is_complete")
      .eq("tournament_id", tournamentId)
      .eq("round_number", tournament.current_round)
      .single();

    if (!currentRound?.is_complete) {
      return NextResponse.json({ error: "Current round not complete" }, { status: 400 });
    }

    // Fetch participants sorted by score (then by seed for tiebreak)
    const { data: participants } = await admin
      .from("tournament_participants")
      .select("player_id, score, seed")
      .eq("tournament_id", tournamentId)
      .order("score", { ascending: false })
      .order("seed", { ascending: true });

    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: "No participants" }, { status: 400 });
    }

    // Swiss pairing for next round:
    // Group by score, pair within score groups, avoid rematches
    const pairings: Array<{ white: string; black: string; bye?: string }> = [];
    const used = new Set<string>();

    // Simple approach: sort by score, pair adjacent players who haven't played each other
    for (let i = 0; i < participants.length; i++) {
      if (used.has(participants[i].player_id)) continue;

      let paired = false;
      for (let j = i + 1; j < participants.length; j++) {
        if (used.has(participants[j].player_id)) continue;

        // Check for previous pairing (simplified — skip rematch check for MVP)
        pairings.push({
          white: participants[i].player_id,
          black: participants[j].player_id,
        });
        used.add(participants[i].player_id);
        used.add(participants[j].player_id);
        paired = true;
        break;
      }

      if (!paired) {
        // Bye
        pairings.push({ white: "", black: "", bye: participants[i].player_id });
        used.add(participants[i].player_id);
      }
    }

    // Create round entry
    await admin.from("tournament_rounds").insert({
      tournament_id: tournamentId,
      round_number: nextRound,
      pairings: pairings.map((p, i) => ({
        board: i + 1,
        white: p.white || null,
        black: p.black || null,
        bye: p.bye || null,
        result: null,
      })),
      is_complete: false,
    });

    // Create games for real pairings, award byes
    for (const pairing of pairings) {
      if (pairing.bye) {
        await admin
          .from("tournament_participants")
          .update({
            score: (participants.find((p) => p.player_id === pairing.bye)?.score || 0) + 1,
            wins: 1,
            games_played: 1,
          })
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
        tournament_round: nextRound,
      });
    }

    // Update tournament current round
    await admin
      .from("tournaments")
      .update({ current_round: nextRound })
      .eq("id", tournamentId);

    return NextResponse.json({ success: true, round: nextRound, pairings: pairings.length });
  } catch (e: any) {
    console.error("Advance round error:", e);
    return NextResponse.json({ error: e.message || "Failed to advance round" }, { status: 500 });
  }
}
