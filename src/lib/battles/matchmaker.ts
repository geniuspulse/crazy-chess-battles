import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CONFIG } from "@/lib/battles/battle-helpers";

/**
 * Try to find a match for the player in the queue.
 * Matches by same stake + compatible rating (+ same time control if provided).
 */
export async function tryMatch(
  admin: ReturnType<typeof createAdminClient>,
  playerId: string,
  stakeCents: number,
  playerRating: number,
  config: typeof DEFAULT_CONFIG,
  timeControl?: string
): Promise<{ matched: boolean; battleId?: string } | null> {
  // Find an opponent in the same stake queue with compatible rating
  let query = admin
    .from("battle_queue")
    .select("id, player_id, rating, created_at")
    .eq("stake_cents", stakeCents)
    .eq("status", "waiting")
    .neq("player_id", playerId)
    .order("created_at", { ascending: true });

  // If time_control column exists, filter by it
  if (timeControl) {
    query = query.eq("time_control", timeControl) as any;
  }

  const { data: candidates } = await query;

  // If filtering by time_control failed (column may not exist), retry without it
  if (!candidates && timeControl) {
    const { data: fallback } = await admin
      .from("battle_queue")
      .select("id, player_id, rating, created_at")
      .eq("stake_cents", stakeCents)
      .eq("status", "waiting")
      .neq("player_id", playerId)
      .order("created_at", { ascending: true });

    return attemptMatch(admin, fallback, playerId, stakeCents, playerRating, config);
  }

  return attemptMatch(admin, candidates, playerId, stakeCents, playerRating, config);
}

async function attemptMatch(
  admin: ReturnType<typeof createAdminClient>,
  candidates: any[] | null,
  playerId: string,
  stakeCents: number,
  playerRating: number,
  config: typeof DEFAULT_CONFIG
): Promise<{ matched: boolean; battleId?: string } | null> {
  if (!candidates || candidates.length === 0) return { matched: false };

  const range = config.rating_range;
  const eligible = candidates.filter(
    (c: { rating: number; player_id: string; id: string; created_at: string }) =>
      Math.abs(c.rating - playerRating) <= range
  );

  if (eligible.length === 0) return { matched: false };

  eligible.sort((a: { rating: number }, b: { rating: number }) =>
    Math.abs(a.rating - playerRating) - Math.abs(b.rating - playerRating)
  );

  for (const opponent of eligible) {
    const { data: claimed, error: claimErr } = await admin
      .from("battle_queue")
      .update({ status: "matched", matched_at: new Date().toISOString() })
      .eq("id", opponent.id)
      .eq("status", "waiting")
      .select("id")
      .single();

    if (claimErr || !claimed) continue;

    const pot = stakeCents * 2;
    const fee = Math.round(pot * (config.platform_fee_pct / 100));
    const payout = pot - fee;

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
      await admin
        .from("battle_queue")
        .update({ status: "waiting", matched_at: null })
        .eq("id", opponent.id);
      return { matched: false };
    }

    await admin
      .from("battle_queue")
      .update({ battle_id: battle.id })
      .eq("id", opponent.id);

    await admin.from("battle_escrow").insert([
      { battle_id: battle.id, player_id: playerId, amount_cents: stakeCents, status: "locked" },
      { battle_id: battle.id, player_id: opponent.player_id, amount_cents: stakeCents, status: "locked" },
    ]);

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

  return { matched: false };
}
