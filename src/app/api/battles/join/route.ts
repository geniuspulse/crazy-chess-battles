import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CONFIG } from "@/lib/battles/battle-helpers";
import { tryMatch } from "@/lib/battles/matchmaker";

/**
 * Join a Battle queue — locks the player's stake in escrow.
 * Body: { stakeCents: number }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { stakeCents } = await req.json();
    if (!stakeCents || stakeCents <= 0) {
      return NextResponse.json({ error: "Invalid stake amount" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get config
    const { data: configRow } = await admin.from("battle_config").select("*").limit(1).single();
    const config = { ...DEFAULT_CONFIG, ...configRow };

    if (!config.enabled) {
      return NextResponse.json({ error: "Chess Battles are currently disabled" }, { status: 403 });
    }

    // Validate stake is an allowed level
    const allowedStakes = config.stake_levels as number[];
    if (!allowedStakes.includes(stakeCents)) {
      return NextResponse.json({ error: "Invalid stake level" }, { status: 400 });
    }

    // Check player isn't already in a queue
    const { data: existing } = await admin
      .from("battle_queue")
      .select("id, stake_cents")
      .eq("player_id", user.id)
      .eq("status", "waiting");

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Already in a battle queue. Leave the current queue first." },
        { status: 400 }
      );
    }

    // Check player isn't in an active battle
    const { data: activeBattle } = await admin
      .from("battles")
      .select("id")
      .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
      .in("status", ["pending", "playing", "draw_armageddon"])
      .limit(1);

    if (activeBattle && activeBattle.length > 0) {
      return NextResponse.json(
        { error: "You have an active battle. Finish it first." },
        { status: 400 }
      );
    }

    // Check wallet balance
    const { data: profile } = await admin
      .from("profiles")
      .select("rating, wallet_balance_cents")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const balance = profile.wallet_balance_cents ?? 0;
    if (balance < stakeCents) {
      return NextResponse.json(
        { error: `Insufficient balance. You need at least MK ${(stakeCents / 100).toLocaleString()}.` },
        { status: 402 }
      );
    }

    // Lock stake — debit wallet
    const { error: debitErr } = await admin.rpc("debit_wallet", {
      p_user_id: user.id,
      p_amount_cents: stakeCents,
    });

    if (debitErr) {
      console.error("Escrow debit failed:", debitErr);
      return NextResponse.json({ error: "Failed to lock stake. Try again." }, { status: 500 });
    }

    // Record escrow transaction
    await admin.from("deposits").insert({
      user_id: user.id,
      amount_cents: stakeCents,
      status: "success",
      method: "battle_escrow",
      reference: `battle_queue:${user.id}:${stakeCents}`,
    });

    // Add to queue
    const { data: queueEntry, error: queueErr } = await admin
      .from("battle_queue")
      .insert({
        player_id: user.id,
        stake_cents: stakeCents,
        rating: profile.rating ?? 1200,
        status: "waiting",
      })
      .select()
      .single();

    if (queueErr) {
      // Refund the debit
      await admin.rpc("credit_wallet", { p_user_id: user.id, p_amount_cents: stakeCents });
      return NextResponse.json({ error: "Failed to join queue" }, { status: 500 });
    }

    // Try to match immediately
    const matchResult = await tryMatch(admin, user.id, stakeCents, profile.rating ?? 1200, config);

    return NextResponse.json({
      queueId: queueEntry.id,
      stakeCents,
      matched: matchResult?.matched ?? false,
      battleId: matchResult?.battleId ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to join battle" }, { status: 500 });
  }
}

/**
 * Try to find a match for the player in the queue.
 * Matches by same stake + compatible rating.
 */
