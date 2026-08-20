export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Users,
  Clock,
  Crown,
  ArrowLeft,
  Coins,
  Award,
  Calendar,
  Layers,
  Swords,
  CheckCircle2,
  CircleDot,
  TrendingUp,
} from "lucide-react";
import TournamentActions from "./tournament-actions";

function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || cents === 0) return "Free";
  const amount = Math.floor(cents / 100);
  return `MWK ${amount.toLocaleString("en-US")}`;
}

function formatPrizePool(cents: number | null | undefined): string {
  if (!cents || cents === 0) return "MWK 0";
  const amount = Math.floor(cents / 100);
  return `MWK ${amount.toLocaleString("en-US")}`;
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch tournament details
  const { data: tournament } = await supabase
    .from("tournaments")
    .select(
      `
      id,
      name,
      description,
      type,
      time_control,
      initial_minutes,
      increment_seconds,
      status,
      max_players,
      min_players,
      min_rating,
      max_rating,
      rounds,
      current_round,
      duration_minutes,
      starts_at,
      ends_at,
      entry_fee_cents,
      prize_pool_cents,
      creator_profit_percent,
      created_by,
      prize_distribution
    `
    )
    .eq("id", id)
    .single();

  if (!tournament) {
    notFound();
  }

  // Fetch participants with profile data
  const { data: rawParticipants } = await supabase
    .from("tournament_participants")
    .select(
      `
      id,
      seed,
      score,
      games_played,
      wins,
      losses,
      draws,
      final_rank,
      joined_at,
      player_id,
      profiles:player_id (
        id,
        username,
        display_name,
        rating,
        avatar_url
      )
    `
    )
    .eq("tournament_id", id)
    .order("score", { ascending: false });

  const participants = rawParticipants || [];

  // Fetch current round pairings and games (for active tournaments)
  let currentRound = null;
  let roundGames: any[] = [];

  if (tournament.status === "active" && tournament.current_round) {
    const { data: roundData } = await supabase
      .from("tournament_rounds")
      .select("id, pairings, is_complete, round_number")
      .eq("tournament_id", id)
      .eq("round_number", tournament.current_round)
      .single();

    currentRound = roundData;

    if (roundData) {
      const { data: games } = await supabase
        .from("games")
        .select("id, white_player_id, black_player_id, status, winner, tournament_round")
        .eq("tournament_id", id)
        .eq("tournament_round", tournament.current_round);
      roundGames = games || [];
    }
  }

  // Check current user profile & participation (optional — page works without auth)
  let isAdmin = false;
  let isCreator = false;
  let isJoined = false;
  let walletBalance = 0;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, wallet_balance_cents")
      .eq("id", user.id)
      .single();

    isAdmin = profile?.is_admin ?? false;
    isCreator = tournament.created_by === user.id;
    isJoined = participants.some((p) => p.player_id === user.id);
    walletBalance = profile?.wallet_balance_cents ?? 0;
  }

  // Fetch creator profile
  let creatorInfo: { username: string; display_name: string } | null = null;
  if (tournament.created_by) {
    const { data: creator } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", tournament.created_by)
      .single();
    if (creator) {
      creatorInfo = { username: creator.username, display_name: creator.display_name || creator.username };
    }
  }

  const isPaid = tournament.entry_fee_cents > 0;
  const isUserCreated = tournament.creator_profit_percent > 0;
  const canManage = isAdmin || isCreator;

  // Economics calculations for display
  const totalCollected = tournament.prize_pool_cents || 0;
  const platformCutPct = 10;
  const platformCut = Math.floor(totalCollected * (platformCutPct / 100));
  const remainder = totalCollected - platformCut;
  const creatorProfit = Math.floor(remainder * ((tournament.creator_profit_percent || 0) / 100));
  const actualPrizePool = remainder - creatorProfit;

  const statusColors: Record<string, string> = {
    upcoming: "text-ccb-accent bg-ccb-accent/10 border-ccb-accent/20",
    active: "text-ccb-success bg-ccb-success/10 border-ccb-success/20",
    finished: "text-ccb-muted bg-ccb-surface border-ccb-muted/20",
    cancelled: "text-ccb-danger bg-ccb-danger/10 border-ccb-danger/20",
  };

  // Sort participants based on status
  const sortedParticipants = [...participants].sort((a, b) => {
    if (tournament.status === "finished") {
      if (a.final_rank && b.final_rank) return a.final_rank - b.final_rank;
      if (a.final_rank) return -1;
      if (b.final_rank) return 1;
      return b.score - a.score;
    }
    if (tournament.status === "active") {
      return b.score - a.score || b.wins - a.wins;
    }
    if (a.seed && b.seed) return a.seed - b.seed;
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      {/* Back button */}
      <div>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 text-sm text-ccb-muted hover:text-ccb-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tournaments</span>
        </Link>
      </div>

      {/* Header card */}
      <div className="card space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">{tournament.name}</h1>
              <span className={`badge border ${statusColors[tournament.status]} capitalize`}>
                {tournament.status}
              </span>
              <span className="badge bg-ccb-surface text-ccb-silver uppercase">
                {tournament.type}
              </span>
              <span className={`badge ${isPaid ? "bg-ccb-success/10 text-ccb-success" : "bg-ccb-primary/10 text-ccb-primary"}`}>
                {isPaid ? "Paid" : "Free"}
              </span>
            </div>
            {tournament.description && (
              <p className="text-sm text-ccb-muted max-w-2xl whitespace-pre-wrap">{tournament.description}</p>
            )}
            {creatorInfo && (
              <p className="text-xs text-ccb-muted">
                Created by <span className="font-medium text-ccb-text">{creatorInfo.display_name}</span>
              </p>
            )}
          </div>

          {/* User & Admin/Creator action buttons */}
          <TournamentActions
            tournamentId={tournament.id}
            status={tournament.status}
            isJoined={isJoined}
            isLoggedIn={!!user}
            entryFeeCents={tournament.entry_fee_cents}
            prizePoolCents={tournament.prize_pool_cents}
            walletBalanceCents={walletBalance}
            isAdmin={isAdmin}
            isCreator={isCreator}
            canManage={canManage}
          />
        </div>

        {/* Tournament Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-ccb-surface">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-ccb-muted">
              <Coins className="w-3.5 h-3.5" />
              <span>Entry Fee</span>
            </div>
            <div className="font-semibold">{formatMoney(tournament.entry_fee_cents)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-ccb-muted">
              <Users className="w-3.5 h-3.5" />
              <span>Players</span>
            </div>
            <div className="font-semibold">
              {participants.length}
              <span className="text-ccb-muted font-normal">
                {tournament.max_players ? ` / ${tournament.max_players}` : ""}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-ccb-muted">
              <Clock className="w-3.5 h-3.5" />
              <span>Time Control</span>
            </div>
            <div className="font-semibold capitalize">
              {tournament.time_control} ({tournament.initial_minutes}+{tournament.increment_seconds})
            </div>
          </div>

          {tournament.min_players && tournament.min_players > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-ccb-muted">
                <Users className="w-3.5 h-3.5" />
                <span>Min Players</span>
              </div>
              <div className="font-semibold">{tournament.min_players}</div>
            </div>
          )}
        </div>

        {/* Schedule & Format Details */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-ccb-muted pt-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Starts:{" "}
              {new Date(tournament.starts_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          {tournament.ends_at && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Ends:{" "}
                {new Date(tournament.ends_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          {tournament.rounds && (
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>
                Rounds: {tournament.current_round || 0} / {tournament.rounds}
              </span>
            </div>
          )}

          {tournament.duration_minutes && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Duration: {tournament.duration_minutes} mins</span>
            </div>
          )}
        </div>
      </div>

      {/* Economics Breakdown — for user-created paid tournaments */}
      {isUserCreated && isPaid && totalCollected > 0 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-ccb-success" />
            Prize Pool & Earnings
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-ccb-surface/50 text-center">
              <p className="text-xs text-ccb-muted mb-1">Total Collected</p>
              <p className="font-bold text-ccb-text">{formatPrizePool(totalCollected)}</p>
            </div>
            <div className="p-3 rounded-lg bg-ccb-surface/50 text-center">
              <p className="text-xs text-ccb-muted mb-1">Platform (10%)</p>
              <p className="font-bold text-ccb-muted">{formatPrizePool(platformCut)}</p>
            </div>
            {creatorInfo && (
              <div className="p-3 rounded-lg bg-ccb-surface/50 text-center">
                <p className="text-xs text-ccb-muted mb-1">Creator ({tournament.creator_profit_percent}%)</p>
                <p className="font-bold text-ccb-success">{formatPrizePool(creatorProfit)}</p>
              </div>
            )}
            <div className="p-3 rounded-lg bg-ccb-accent/10 text-center">
              <p className="text-xs text-ccb-muted mb-1">Prize Pool</p>
              <p className="font-bold text-ccb-accent">{formatPrizePool(actualPrizePool)}</p>
            </div>
          </div>
          {tournament.status === "upcoming" && (
            <p className="text-xs text-ccb-muted pt-2 border-t border-ccb-surface">
              Prize pool grows as players join. Final amounts calculated when tournament ends.
            </p>
          )}
        </div>
      )}

      {/* Prize Distribution Breakdown */}
      {((isPaid && totalCollected > 0) || (tournament.prize_pool_cents && tournament.prize_pool_cents > 0 && !isUserCreated)) && (
        <div className="card space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-ccb-accent" />
            Prize Distribution
          </h2>
          <div className="space-y-3">
            {(() => {
              const RANK_LABELS: Record<number, { label: string; color: string }> = {
                1: { label: "1st Place", color: "text-ccb-accent" },
                2: { label: "2nd Place", color: "text-ccb-silver" },
                3: { label: "3rd Place", color: "text-ccb-bronze" },
                4: { label: "4th Place", color: "text-ccb-muted" },
                5: { label: "5th Place", color: "text-ccb-muted" },
              };
              const fallback = [
                { rank: 1, percentage: 40 },
                { rank: 2, percentage: 20 },
                { rank: 3, percentage: 18 },
                { rank: 4, percentage: 12 },
                { rank: 5, percentage: 10 },
              ];
              const tiers: Array<{ rank: number; percentage: number }> =
                tournament.prize_distribution?.payouts?.length > 0
                  ? tournament.prize_distribution.payouts
                  : fallback;

              // For user-created tournaments, show estimated prize pool
              const displayPrizePool = isUserCreated ? actualPrizePool : tournament.prize_pool_cents;

              return tiers
                .sort((a, b) => a.rank - b.rank)
                .map((tier) => {
                  const amount = Math.floor(displayPrizePool * (tier.percentage / 100));
                  const meta = RANK_LABELS[tier.rank] || { label: `${tier.rank}th Place`, color: "text-ccb-muted" };
                  return (
                    <div key={tier.rank} className="flex items-center justify-between p-3 rounded-lg bg-ccb-surface/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-ccb-surface flex items-center justify-center text-sm font-bold ${meta.color}`}>
                          {tier.rank}
                        </div>
                        <span className="text-sm font-medium">{meta.label}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-ccb-accent">MWK {Math.floor(amount / 100).toLocaleString("en-US")}</div>
                        <div className="text-xs text-ccb-muted">{tier.percentage}% of prize pool</div>
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
          {tournament.status === "finished" && (
            <p className="text-xs text-ccb-muted pt-2 border-t border-ccb-surface">
              Prizes have been distributed to winners' wallets.
            </p>
          )}
        </div>
      )}

      {/* Current Round — pairings & games */}
      {currentRound && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Swords className="w-5 h-5 text-ccb-primary" />
              Round {tournament.current_round} Pairings
            </h2>
            <span className="text-xs text-ccb-muted">
              {currentRound.is_complete ? "Complete" : "In Progress"}
            </span>
          </div>

          <div className="space-y-2">
            {currentRound.pairings?.map((pairing: any, i: number) => {
              const whiteP = participants.find((p) => p.player_id === pairing.white);
              const blackP = participants.find((p) => p.player_id === pairing.black);
              const byeP = participants.find((p) => p.player_id === pairing.bye);
              const whiteProfile = whiteP ? (Array.isArray(whiteP.profiles) ? whiteP.profiles[0] : whiteP.profiles) : null;
              const blackProfile = blackP ? (Array.isArray(blackP.profiles) ? blackP.profiles[0] : blackP.profiles) : null;
              const byeProfile = byeP ? (Array.isArray(byeP.profiles) ? byeP.profiles[0] : byeP.profiles) : null;
              const game = roundGames.find((g: any) =>
                (g.white_player_id === pairing.white && g.black_player_id === pairing.black) ||
                (g.white_player_id === pairing.black && g.black_player_id === pairing.white)
              );
              const hasResult = pairing.result !== null && pairing.result !== undefined;

              return (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-ccb-surface/50 border border-ccb-surface gap-3"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-ccb-muted font-mono shrink-0">#{pairing.board}</span>
                    {pairing.bye ? (
                      <span className="text-sm">
                        <span className="font-semibold">{byeProfile?.display_name || byeProfile?.username || "Player"}</span>
                        <span className="ml-2 text-xs text-ccb-accent">BYE</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-sm truncate">
                          {whiteProfile?.display_name || whiteProfile?.username || "Player"}
                          <span className="text-ccb-muted text-xs ml-1">({whiteProfile?.rating || "?"})</span>
                        </span>
                        <span className="text-xs text-ccb-muted shrink-0">vs</span>
                        <span className="text-sm truncate">
                          {blackProfile?.display_name || blackProfile?.username || "Player"}
                          <span className="text-ccb-muted text-xs ml-1">({blackProfile?.rating || "?"})</span>
                        </span>
                      </>
                    )}
                  </div>

                  <div className="shrink-0">
                    {game ? (
                      <Link
                        href={`/play/${game.id}`}
                        className="text-xs font-medium text-ccb-primary hover:underline"
                      >
                        {game.status === "finished" ? (
                          <span className="text-ccb-muted">Finished</span>
                        ) : game.status === "playing" ? (
                          <span className="text-ccb-success">Watch →</span>
                        ) : (
                          <span>View →</span>
                        )}
                      </Link>
                    ) : hasResult ? (
                      <span className="text-xs text-ccb-muted">Done</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Participants */}
      <div className="card space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-ccb-primary" />
          Participants ({participants.length})
        </h2>

        {participants.length === 0 ? (
          <p className="text-sm text-ccb-muted text-center py-6">
            No one has joined yet. Be the first!
          </p>
        ) : (
          <div className="space-y-1">
            {sortedParticipants.map((p, i) => {
              const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
              const rank = tournament.status === "finished" && p.final_rank
                ? p.final_rank
                : i + 1;

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-ccb-surface/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      rank === 1 ? "bg-ccb-accent/20 text-ccb-accent"
                      : rank === 2 ? "bg-ccb-silver/20 text-ccb-silver"
                      : rank === 3 ? "bg-ccb-bronze/20 text-ccb-bronze"
                      : "bg-ccb-surface text-ccb-muted"
                    }`}>
                      {rank}
                    </span>
                    {profile?.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-6 h-6 rounded-full shrink-0"
                      />
                    )}
                    <span className="text-sm font-medium">
                      {profile?.display_name || profile?.username || "Player"}
                    </span>
                    <span className="text-xs text-ccb-muted">({profile?.rating || "?"})</span>
                  </div>

                  {tournament.status !== "upcoming" && (
                    <div className="flex items-center gap-3 text-xs text-ccb-muted">
                      <span>{p.score || 0} pts</span>
                      <span className="text-ccb-success">{p.wins || 0}W</span>
                      <span className="text-ccb-muted">{p.losses || 0}L</span>
                      <span className="text-ccb-muted">{p.draws || 0}D</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
