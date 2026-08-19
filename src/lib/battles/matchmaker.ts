import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CONFIG } from "@/lib/battles/battle-helpers";

/**
 * Try to find a match for the player in the queue.
 * Matches by same stake + compatible rating.
 *
 * Race condition fix: Uses an atomic conditional UPDATE to claim the opponent's
 * queue entry (status='waiting' -> status='matched'), preventing two players
 * from matching the same opponent simultaneously.
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

  // Try to atomically claim each eligible opponent (prevents race condition)
  for (const opponent of eligible) {
    // Atomic claim: only update if still 'waiting' (prevents double-matching)
    const { data: claimed, error: claimErr } = await admin
      .from("battle_queue")
      .update({ status: "matched", matched_at: new Date().toISOString() })
      .eq("id", opponent.id)
      .eq("status", "waiting")
      .select("id")
      .single();

    // If we couldn't claim this opponent (already matched by someone else), try next
    if (claimErr || !claimed) continue;

    // Successfully claimed — create the battle
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
      // Release the opponent's queue entry back to waiting
      await admin
        .from("battle_queue")
        .update({ status: "waiting", matched_at: null })
        .eq("id", opponent.id);
      return { matched: false };
    }

    // Link the battle to the opponent's queue entry
    await admin
      .from("battle_queue")
      .update({ battle_id: battle.id })
      .eq("id", opponent.id);

    // Record escrow for both players
    await admin.from("battle_escrow").insert([
      { battle_id: battle.id, player_id: playerId, amount_cents: stakeCents, status: "locked" },
      { battle_id: battle.id, player_id: opponent.player_id, amount_cents: stakeCents, status: "locked" },
    ]);

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

  // All eligible opponents were already claimed by other players
  return { matched: false };
}
