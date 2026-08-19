import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CONFIG } from "@/lib/battles/battle-helpers";

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
    return { matched: false };
  }

  // Record escrow for both players
  await admin.from("battle_escrow").insert([
    { battle_id: battle.id, player_id: playerId, amount_cents: stakeCents, status: "locked" },
    { battle_id: battle.id, player_id: opponent.player_id, amount_cents: stakeCents, status: "locked" },
  ]);

  // Update opponent's queue entry
  await admin
    .from("battle_queue")
    .update({ status: "matched", battle_id: battle.id, matched_at: new Date().toISOString() })
    .eq("id", opponent.id);

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
