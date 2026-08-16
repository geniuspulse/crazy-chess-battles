import { createAdminClient } from "@/lib/supabase/admin";

interface PrizeDistribution {
  type: "flat" | "percentage" | "tiered";
  payouts: Array<{ rank: number; amount_cents?: number; percentage?: number }>;
}

interface ParticipantResult {
  player_id: string;
  final_rank: number | null;
  score: number;
}

/**
 * Distribute prize pool to winners based on tournament's prize_distribution config.
 * Called after tournament.finish() sets final_rank on all participants.
 */
export async function distributePrizes(
  tournamentId: string,
  participants: ParticipantResult[],
  prizePoolCents: number,
  prizeDistribution: PrizeDistribution
) {
  if (!prizePoolCents || prizePoolCents <= 0) return;
  if (!participants.length) return;

  const admin = createAdminClient();
  const payouts: Array<{ player_id: string; amount_cents: number; rank: number }> = [];

  if (prizeDistribution.type === "flat" && prizeDistribution.payouts.length > 0) {
    // Fixed amounts per rank
    for (const payout of prizeDistribution.payouts) {
      const winner = participants.find((p) => p.final_rank === payout.rank);
      if (winner && payout.amount_cents) {
        payouts.push({ player_id: winner.player_id, amount_cents: payout.amount_cents, rank: payout.rank });
      }
    }
  } else if (prizeDistribution.type === "percentage" && prizeDistribution.payouts.length > 0) {
    // Percentage of prize pool per rank
    for (const payout of prizeDistribution.payouts) {
      const winner = participants.find((p) => p.final_rank === payout.rank);
      if (winner && payout.percentage) {
        const amount = Math.floor(prizePoolCents * (payout.percentage / 100));
        if (amount > 0) {
          payouts.push({ player_id: winner.player_id, amount_cents: amount, rank: payout.rank });
        }
      }
    }
  } else {
    // Default: top 3 split 50/30/20
    const defaultSplits = [
      { rank: 1, percentage: 50 },
      { rank: 2, percentage: 30 },
      { rank: 3, percentage: 20 },
    ];
    for (const split of defaultSplits) {
      const winner = participants.find((p) => p.final_rank === split.rank);
      if (winner) {
        const amount = Math.floor(prizePoolCents * (split.percentage / 100));
        if (amount > 0) {
          payouts.push({ player_id: winner.player_id, amount_cents: amount, rank: split.rank });
        }
      }
    }
  }

  // Credit winners' wallets
  for (const payout of payouts) {
    await admin.rpc("credit_wallet", {
      p_user_id: payout.player_id,
      p_amount_cents: payout.amount_cents,
    });

    // Record the payout as a deposit entry for audit trail
    await admin.from("deposits").insert({
      user_id: payout.player_id,
      amount_cents: payout.amount_cents,
      status: "success",
      method: "tournament_payout",
      reference: `tournament:${tournamentId}:rank:${payout.rank}`,
    });
  }

  // Update tournament with actual payouts
  await admin
    .from("tournaments")
    .update({
      prize_distribution: {
        ...prizeDistribution,
        actual_payouts: payouts.map((p) => ({
          player_id: p.player_id,
          amount_cents: p.amount_cents,
          rank: p.rank,
        })),
      },
    })
    .eq("id", tournamentId);

  return payouts;
}
