import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Core battle settlement logic — extracted so it can be called directly
 * instead of via internal HTTP fetch (which hangs in Vercel serverless).
 *
 * Returns: { settled: boolean, result?: string, gameId?: string, round?: number, winnerId?: string, payout?: number }
 */
export interface SettlementResult {
  settled: boolean;
  result?: string;
  gameId?: string;
  round?: number;
  winnerId?: string;
  payout?: number;
}

export async function settleBattle(
  battleId: string,
  winnerId: string | null,
  result: string
): Promise<SettlementResult> {
  const admin = createAdminClient();

  // Load battle
  const { data: battle } = await admin
    .from("battles")
    .select("*")
    .eq("id", battleId)
    .single();

  if (!battle) throw new Error("Battle not found");

  // Prevent double settlement
  if (battle.settled) {
    return { settled: true, result: "already_settled" };
  }

  if (winnerId === null) {
    // Draw — trigger armageddon
    const { data: config } = await admin.from("battle_config").select("*").limit(1).single();
    const maxRounds = config?.max_armageddon_rounds ?? 3;

    if (battle.armageddon_round >= maxRounds) {
      // Max armageddon rounds reached — split the pot (refund both stakes)
      await admin.rpc("credit_wallet", {
        p_user_id: battle.white_player_id,
        p_amount_cents: battle.stake_cents,
      });
      await admin.rpc("credit_wallet", {
        p_user_id: battle.black_player_id,
        p_amount_cents: battle.stake_cents,
      });

      await admin
        .from("battles")
        .update({
          status: "completed",
          result: "draw_max_armageddon",
          settled: true,
          completed_at: new Date().toISOString(),
          notes: "Refunded after max armageddon rounds",
        })
        .eq("id", battleId);

      // Trigger referral activation for both players (non-fatal)
      try {
        await admin.rpc("check_referral_activation", { p_user_id: battle.white_player_id, p_action: "battle" });
        await admin.rpc("check_referral_activation", { p_user_id: battle.black_player_id, p_action: "battle" });
      } catch (e) {
        console.error("Referral activation failed:", e);
      }

      // Release escrow
      await admin
        .from("battle_escrow")
        .update({ status: "refunded", released_at: new Date().toISOString() })
        .eq("battle_id", battleId);

      return { settled: true, result: "draw_refund" };
    }

    // Start armageddon round
    const armMinutes = Math.max(
      1,
      Math.round((config?.initial_minutes ?? 5) * (config?.armageddon_pct ?? 50) / 100)
    );

    // Create armageddon game (swap colors)
    const { data: agGameId, error: agErr } = await admin.rpc("create_game", {
      p_white_id: battle.black_player_id, // swap colors
      p_black_id: battle.white_player_id,
      p_initial_minutes: armMinutes,
      p_increment_seconds: 0,
      p_rated: true,
      p_tournament_id: null,
      p_time_control: "armageddon",
    });

    if (agErr || !agGameId) {
      console.error("Armageddon game creation failed:", agErr);
      throw new Error("Failed to start armageddon");
    }

    await admin
      .from("battles")
      .update({
        status: "draw_armageddon",
        armageddon_game_id: agGameId,
        armageddon_round: battle.armageddon_round + 1,
        result: `draw_armageddon_round_${battle.armageddon_round + 1}`,
      })
      .eq("id", battleId);

    return {
      settled: false,
      result: "armageddon",
      gameId: agGameId as string,
      round: battle.armageddon_round + 1,
    };
  }

  // Validate winner is a participant
  if (winnerId !== battle.white_player_id && winnerId !== battle.black_player_id) {
    throw new Error("Invalid winner");
  }

  // Pay the winner
  const payout = battle.winner_payout_cents;
  const { error: creditErr } = await admin.rpc("credit_wallet", {
    p_user_id: winnerId,
    p_amount_cents: payout,
  });

  if (creditErr) {
    console.error("Winner payout failed:", creditErr);
    throw new Error("Failed to pay winner");
  }

  // Record payout (non-fatal audit trail)
  const { error: _depErr } = await admin.from("deposits").insert({
    user_id: winnerId,
    amount_cents: payout,
    status: "success",
    method: "battle_payout",
    reference: `battle:${battleId}:payout`,
  });
  if (_depErr) console.error("Deposit audit log failed:", _depErr);

  // Mark battle as completed and settled
  await admin
    .from("battles")
    .update({
      status: "completed",
      winner_id: winnerId,
      result: result || "win",
      settled: true,
      completed_at: new Date().toISOString(),
    })
    .eq("id", battleId);

  // Release escrow
  await admin
    .from("battle_escrow")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("battle_id", battleId);

  // Trigger referral activation for both players (non-fatal)
  try {
    await admin.rpc("check_referral_activation", { p_user_id: battle.white_player_id, p_action: "battle" });
    await admin.rpc("check_referral_activation", { p_user_id: battle.black_player_id, p_action: "battle" });
  } catch (e) {
    console.error("Referral activation failed:", e);
  }

  return { settled: true, winnerId, payout, result: result || "win" };
}
