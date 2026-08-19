import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — list all tournaments with participant counts
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: tournaments, error } = await admin
      .from("tournaments")
      .select(`
        id, name, format, status, entry_fee_cents, prize_pool_cents,
        max_players, current_round, total_rounds, starts_at, created_at
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get participant counts
    const tournamentIds = tournaments?.map(t => t.id) || [];
    let participantCounts: Record<string, number> = {};
    if (tournamentIds.length > 0) {
      const { data: participants } = await admin
        .from("tournament_participants")
        .select("tournament_id")
        .in("tournament_id", tournamentIds);
      for (const p of participants || []) {
        participantCounts[p.tournament_id] = (participantCounts[p.tournament_id] || 0) + 1;
      }
    }

    return NextResponse.json({
      tournaments: tournaments?.map(t => ({
        ...t,
        participant_count: participantCounts[t.id] || 0,
      })) || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to fetch tournaments" }, { status: 500 });
  }
}

// PATCH — cancel or force-finish a tournament
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { tournamentId, action } = await req.json();
    if (!tournamentId || !action) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    if (action === "cancel") {
      const { error } = await admin
        .from("tournaments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", tournamentId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Refund entry fees to participants
      const { data: participants } = await admin
        .from("tournament_participants")
        .select("user_id, entry_fee_cents")
        .eq("tournament_id", tournamentId);

      for (const p of participants || []) {
        if (p.entry_fee_cents > 0) {
          await admin.rpc("credit_wallet", {
            p_user_id: p.user_id,
            p_amount_cents: p.entry_fee_cents,
          });
        }
      }
    } else if (action === "force_finish") {
      const { error } = await admin
        .from("tournaments")
        .update({ status: "finished", updated_at: new Date().toISOString() })
        .eq("id", tournamentId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Log
    try {
      await admin.from("admin_logs").insert({
        admin_id: user.id,
        action: `tournament_${action}`,
        target_type: "tournament",
        target_id: tournamentId,
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
