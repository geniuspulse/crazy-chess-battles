import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CONFIG } from "@/lib/battles/battle-helpers";

/**
 * Settle a battle — pays out the winner, takes platform fee.
 * Called server-side after a game ends (from game resign/timeout/move API).
 * Body: { battleId: string, winnerId: string | null, result: string }
 * winnerId null = draw (triggers armageddon)
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();

    const { battleId, winnerId, result } = await req.json();
    if (!battleId) return NextResponse.json({ error: "Battle ID required" }, { status: 400 });

    // Load battle with lock check
    const { data: battle } = await admin
      .from("battles")
      .select("*")
      .eq("id", battleId)
      .single();

    if (!battle) return NextResponse.json({ error: "Battle not found" }, { status: 404 });

    // Prevent double settlement
    if (battle.settled) {
      return NextResponse.json({ error: "Battle already settled" }, { status: 400 });
    }

    if (winnerId === null) {
      // Draw — trigger armageddon
      const { data: config } = await admin.from("battle_config").select("*").limit(1).single();
      const maxRounds = config?.max_armageddon_rounds ?? 3;

      if (battle.armageddon_round >= maxRounds) {
        // Max armageddon rounds reached — split the pot
        const halfPot = Math.floor(battle.pot_cents / 2);
        const halfFee = Math.floor(battle.platform_fee_cents / 2);

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

        // Trigger referral activation for both players
        await admin.rpc("check_referral_activation", { p_user_id: battle.white_player_id, p_action: "battle" });
        await admin.rpc("check_referral_activation", { p_user_id: battle.black_player_id, p_action: "battle" });

        // Release escrow
        await admin
          .from("battle_escrow")
          .update({ status: "refunded", released_at: new Date().toISOString() })
          .eq("battle_id", battleId);

        return NextResponse.json({ settled: true, result: "draw_refund" });
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
        return NextResponse.json({ error: "Failed to start armageddon" }, { status: 500 });
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

      return NextResponse.json({
        settled: false,
        result: "armageddon",
        gameId: agGameId,
        round: battle.armageddon_round + 1,
      });
    }

    // Validate winner is a participant
    if (winnerId !== battle.white_player_id && winnerId !== battle.black_player_id) {
      return NextResponse.json({ error: "Invalid winner" }, { status: 400 });
    }

    // Pay the winner
    const payout = battle.winner_payout_cents;
    const { error: creditErr } = await admin.rpc("credit_wallet", {
      p_user_id: winnerId,
      p_amount_cents: payout,
    });

    if (creditErr) {
      console.error("Winner payout failed:", creditErr);
      return NextResponse.json({ error: "Failed to pay winner" }, { status: 500 });
    }

    // Record payout
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

    // Trigger referral activation for both players
    await admin.rpc("check_referral_activation", { p_user_id: battle.white_player_id, p_action: "battle" });
    await admin.rpc("check_referral_activation", { p_user_id: battle.black_player_id, p_action: "battle" });

    return NextResponse.json({ settled: true, winnerId, payout });
  } catch (e: any) {
    console.error("Battle settlement error:", e);
    return NextResponse.json({ error: e.message || "Settlement failed" }, { status: 500 });
  }
}

/**
 * Called by cron to auto-settle battles where a player timed out or disconnected.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find battles with ended games that haven't been settled
  const { data: activeBattles } = await admin
    .from("battles")
    .select(`
      id, game_id, armageddon_game_id, status, white_player_id, black_player_id, armageddon_round
    `)
    .in("status", ["playing", "draw_armageddon"]);

  if (!activeBattles || activeBattles.length === 0) {
    return NextResponse.json({ checked: 0, settled: 0 });
  }

  let settled = 0;
  for (const battle of activeBattles) {
    const gameId = battle.armageddon_game_id || battle.game_id;
    if (!gameId) continue;

    const { data: game } = await admin
      .from("games")
      .select("status, winner")
      .eq("id", gameId)
      .single();

    if (!game || game.status === "playing") continue;

    // Game is over — determine winner
    let winnerId: string | null = null;
    if (game.winner === "white") {
      winnerId = battle.armageddon_game_id ? battle.black_player_id : battle.white_player_id;
    } else if (game.winner === "black") {
      winnerId = battle.armageddon_game_id ? battle.white_player_id : battle.black_player_id;
    }

    // Settle via POST logic (call the settlement directly)
    if (winnerId) {
      // Pay out
      const { data: battleData } = await admin.from("battles").select("settled, pot_cents, platform_fee_cents, winner_payout_cents, stake_cents").eq("id", battle.id).single();
      if (battleData && !battleData.settled) {
        await admin.rpc("credit_wallet", { p_user_id: winnerId, p_amount_cents: battleData.winner_payout_cents });
        const { error: _depErr } = await admin.from("deposits").insert({
          user_id: winnerId,
          amount_cents: battleData.winner_payout_cents,
          status: "success",
          method: "battle_payout",
          reference: `battle:${battle.id}:auto_settle`,
        });
    if (_depErr) console.error("Deposit audit log failed:", _depErr);
        await admin.from("battles").update({
          status: "completed",
          winner_id: winnerId,
          result: game.status,
          settled: true,
          completed_at: new Date().toISOString(),
        }).eq("id", battle.id);
        await admin.from("battle_escrow").update({ status: "released", released_at: new Date().toISOString() }).eq("battle_id", battle.id);
        settled++;
      }
    } else {
      // Draw — trigger armageddon
      // For cron, just mark as needing armageddon (settlement POST will handle it)
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/battles/settle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ battleId: battle.id, winnerId: null, result: game.status }),
        });
        settled++;
      } catch (e) {
        console.error("Auto-armageddon failed for battle", battle.id, e);
      }
    }
  }

  return NextResponse.json({ checked: activeBattles.length, settled });
}
