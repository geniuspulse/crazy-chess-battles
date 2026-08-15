import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;

    // Verify tournament exists and is upcoming
    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("id, status, max_players")
      .eq("id", tournamentId)
      .single();

    if (tErr || !tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.status !== "upcoming") {
      return NextResponse.json(
        { error: "Tournament is not accepting new participants" },
        { status: 400 }
      );
    }

    // Check capacity if max_players is set
    if (tournament.max_players) {
      const { count } = await supabase
        .from("tournament_participants")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId);

      if (count !== null && count >= tournament.max_players) {
        return NextResponse.json({ error: "Tournament is full" }, { status: 400 });
      }
    }

    // Join tournament
    const { error: joinErr } = await supabase
      .from("tournament_participants")
      .insert({
        tournament_id: tournamentId,
        player_id: user.id,
      });

    if (joinErr) {
      if (joinErr.code === "23505") {
        return NextResponse.json({ error: "Already registered for this tournament" }, { status: 400 });
      }
      return NextResponse.json({ error: joinErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Failed to join tournament" },
      { status: 500 }
    );
  }
}
