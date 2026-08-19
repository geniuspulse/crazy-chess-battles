import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CONFIG } from "@/lib/battles/battle-helpers";

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
export async function tryMatch(
  admin: ReturnType<typeof createAdminClient>,
  playerId: string,
  stakeCents: number,
  playerRating: number,
  config: typeof DEFAULT_CONFIG
): Promise<{ matched: boolean; battleId?: string } | null> {
  // Find an opponent in the same stake queue with compatible rating
  const { data: candidates } = await admin
    .from("battle_queue")
    .select("id, player_id, rating, created_at")
    .eq("stake_cents", stakeCents)
    .eq("status", "waiting")
    .neq("player_id", playerId)
    .order("created_at", { ascending: true });

  if (!candidates || candidates.length === 0) return { matched: false };

  const range = config.rating_range;
  const eligible = candidates.filter(
    (c: { rating: number; player_id: string; id: string; created_at: string }) =>
      Math.abs(c.rating - playerRating) <= range
  );

  if (eligible.length === 0) return { matched: false };

  // Pick the closest rating match
  eligible.sort((a: { rating: number }, b: { rating: number }) =>
    Math.abs(a.rating - playerRating) - Math.abs(b.rating - playerRating)
  );

  const opponent = eligible[0];

  // Create the battle
  const { pot, fee, payout } = {
    pot: stakeCents * 2,
    fee: Math.round(stakeCents * 2 * (config.platform_fee_pct / 100)),
    payout: stakeCents * 2 - Math.round(stakeCents * 2 * (config.platform_fee_pct / 100)),
  };

  const { data: battle, error: battleErr } = await admin
    .from("battles")
    .insert({
      white_player_id: playerId,
      black_player_id: opponent.player_id,
      stake_cents: stakeCents,
      pot_cents: pot,
      platform_fee_cents: fee,
      winner_payout_cents: payout,
      status: "pending",
      white_rating: playerRating,
      black_rating: opponent.rating,
    })
    .select()
    .single();

  if (battleErr || !battle) {
    console.error("Battle creation failed:", battleErr);
    return { matched: false };
  }

  // Record escrow for both players
  await admin.from("battle_escrow").insert([
    { battle_id: battle.id, player_id: playerId, amount_cents: stakeCents, status: "locked" },
    { battle_id: battle.id, player_id: opponent.player_id, amount_cents: stakeCents, status: "locked" },
  ]);

  // Update both queue entries
  await admin
    .from("battle_queue")
    .update({ status: "matched", battle_id: battle.id, matched_at: new Date().toISOString() })
    .in("id", [opponent.id]);

  // Find and update the player's own queue entry
  const { data: playerQueue } = await admin
    .from("battle_queue")
    .select("id")
    .eq("player_id", playerId)
    .eq("status", "waiting")
    .limit(1);

  if (playerQueue && playerQueue[0]) {
    await admin
      .from("battle_queue")
      .update({ status: "matched", battle_id: battle.id, matched_at: new Date().toISOString() })
      .eq("id", playerQueue[0].id);
  }

  return { matched: true, battleId: battle.id };
}
