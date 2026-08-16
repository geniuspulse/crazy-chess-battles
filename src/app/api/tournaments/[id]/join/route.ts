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

    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;

    // Verify tournament exists and is upcoming
    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("id, status, max_players, min_rating, max_rating, entry_fee_cents, prize_pool_cents")
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

    // Enforce rating restrictions
    const { data: profile } = await supabase
      .from("profiles")
      .select("rating, wallet_balance_cents")
      .eq("id", user.id)
      .single();

    if (profile) {
      if (tournament.min_rating && profile.rating < tournament.min_rating) {
        return NextResponse.json({ error: `Minimum rating of ${tournament.min_rating} required` }, { status: 400 });
      }
      if (tournament.max_rating && profile.rating > tournament.max_rating) {
        return NextResponse.json({ error: `Maximum rating of ${tournament.max_rating} required` }, { status: 400 });
      }
    }

    // Handle entry fee — debit wallet if fee > 0
    const entryFee = tournament.entry_fee_cents || 0;
    let paidEntryFee = false;

    if (entryFee > 0) {
      // Check wallet balance
      const currentBalance = profile?.wallet_balance_cents ?? 0;
      if (currentBalance < entryFee) {
        const feeMwk = Math.floor(entryFee / 100);
        return NextResponse.json(
          { error: `Insufficient wallet balance. Entry fee is MWK ${feeMwk.toLocaleString()}. Please deposit funds first.` },
          { status: 402 }
        );
      }

      // Debit wallet atomically
      const admin = createAdminClient();
      const { error: debitErr } = await admin.rpc("debit_wallet", {
        p_user_id: user.id,
        p_amount_cents: entryFee,
      });

      if (debitErr) {
        console.error("Entry fee debit failed:", debitErr);
        return NextResponse.json(
          { error: "Failed to process entry fee payment. Please try again." },
          { status: 500 }
        );
      }

      paidEntryFee = true;

      // Add entry fee to prize pool
      await admin
        .from("tournaments")
        .update({
          prize_pool_cents: (tournament.prize_pool_cents || 0) + entryFee,
        })
        .eq("id", tournamentId);

      // Record deposit entry for audit trail
      await admin.from("deposits").insert({
        user_id: user.id,
        amount_cents: entryFee,
        status: "success",
        method: "tournament_entry",
        reference: `tournament:${tournamentId}:entry`,
      });
    }

    // Join tournament
    const { error: joinErr } = await supabase
      .from("tournament_participants")
      .insert({
        tournament_id: tournamentId,
        player_id: user.id,
        paid_entry_fee: paidEntryFee,
      });

    if (joinErr) {
      if (joinErr.code === "23505") {
        // Already joined — refund if we debited
        if (paidEntryFee) {
          const admin = createAdminClient();
          await admin.rpc("credit_wallet", {
            p_user_id: user.id,
            p_amount_cents: entryFee,
          });
        }
        return NextResponse.json({ error: "Already registered for this tournament" }, { status: 400 });
      }
      // Refund on any other error
      if (paidEntryFee) {
        const admin = createAdminClient();
        await admin.rpc("credit_wallet", {
          p_user_id: user.id,
          p_amount_cents: entryFee,
        });
      }
      return NextResponse.json({ error: joinErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, paidEntryFee });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Failed to join tournament" },
      { status: 500 }
    );
  }
}
