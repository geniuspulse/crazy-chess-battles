import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { distributePrizes } from "@/lib/tournament/prizes";

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
      return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;
    const admin = createAdminClient();

    // Fetch tournament details for prize distribution
    const { data: tournament } = await admin
      .from("tournaments")
      .select("prize_pool_cents, prize_distribution")
      .eq("id", tournamentId)
      .single();

    // Mark tournament as finished
    const { error } = await admin
      .from("tournaments")
      .update({ status: "finished", ended_at: new Date().toISOString() })
      .eq("id", tournamentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Rank participants by score (then by wins as tiebreak)
    const { data: participants } = await admin
      .from("tournament_participants")
      .select("id, player_id, score, wins")
      .eq("tournament_id", tournamentId)
      .order("score", { ascending: false })
      .order("wins", { ascending: false });

    if (participants && participants.length > 0) {
      // Assign final ranks
      const rankedParticipants = participants.map((p, i) => ({
        ...p,
        final_rank: i + 1,
      }));

      for (const p of rankedParticipants) {
        await admin
          .from("tournament_participants")
          .update({ final_rank: p.final_rank })
          .eq("id", p.id);
      }

      // Distribute prize pool to winners
      if (tournament?.prize_pool_cents && tournament.prize_pool_cents > 0) {
        await distributePrizes(
          tournamentId,
          rankedParticipants.map((p) => ({
            player_id: p.player_id,
            final_rank: p.final_rank,
            score: p.score ?? 0,
          })),
          tournament.prize_pool_cents,
          tournament.prize_distribution || { type: "flat", payouts: [] }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to finish tournament" }, { status: 500 });
  }
}
