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
      min_rating,
      max_rating,
      rounds,
      current_round,
      duration_minutes,
      starts_at,
      ends_at,
      entry_fee_cents,
      prize_pool_cents,
      created_by
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

  // Check current user profile & participation
  let isAdmin = false;
  let isJoined = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    isAdmin = profile?.is_admin ?? false;
    isJoined = participants.some((p) => p.player_id === user.id);
  }

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
    // upcoming: sort by seed if present, or joined_at
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
            </div>
            {tournament.description && (
              <p className="text-sm text-ccb-muted max-w-2xl">{tournament.description}</p>
            )}
          </div>

          {/* User & Admin action buttons */}
          <TournamentActions
            tournamentId={tournament.id}
            status={tournament.status}
            isJoined={isJoined}
            entryFeeCents={tournament.entry_fee_cents}
            prizePoolCents={tournament.prize_pool_cents}
            isAdmin={isAdmin}
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

      {/* Prize Distribution Breakdown */}
      {tournament.prize_pool_cents && tournament.prize_pool_cents > 0 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-ccb-accent" />
            Prize Distribution
          </h2>
          <div className="space-y-3">
            {[
              { rank: 1, pct: 40, label: "1st Place", color: "text-ccb-accent" },
              { rank: 2, pct: 20, label: "2nd Place", color: "text-ccb-silver" },
              { rank: 3, pct: 18, label: "3rd Place", color: "text-ccb-bronze" },
              { rank: 4, pct: 12, label: "4th Place", color: "text-ccb-muted" },
              { rank: 5, pct: 10, label: "5th Place", color: "text-ccb-muted" },
            ].map((tier) => {
              const amount = Math.floor(tournament.prize_pool_cents * (tier.pct / 100));
              return (
                <div key={tier.rank} className="flex items-center justify-between p-3 rounded-lg bg-ccb-surface/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-ccb-surface flex items-center justify-center text-sm font-bold ${tier.color}`}>
                      {tier.rank}
                    </div>
                    <span className="text-sm font-medium">{tier.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-ccb-accent">MWK {Math.floor(amount / 100).toLocaleString("en-US")}</div>
                    <div className="text-xs text-ccb-muted">{tier.pct}% of prize pool</div>
                  </div>
                </div>
              );
            })}
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
                      <span className="text-sm flex items-center gap-2 flex-wrap">
                        <span className={pairing.result === "black" ? "text-ccb-muted line-through" : "font-semibold"}>
                          {whiteProfile?.display_name || whiteProfile?.username || "Player"}
                        </span>
                        <span className="text-ccb-muted text-xs">vs</span>
                        <span className={pairing.result === "white" ? "text-ccb-muted line-through" : "font-semibold"}>
                          {blackProfile?.display_name || blackProfile?.username || "Player"}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="shrink-0">
                    {pairing.bye ? (
                      <CheckCircle2 className="w-4 h-4 text-ccb-success" />
                    ) : hasResult ? (
                      <span className="text-xs px-2 py-1 rounded bg-ccb-success/10 text-ccb-success font-mono">
                        {pairing.result === "white" ? "1-0" : pairing.result === "black" ? "0-1" : "½-½"}
                      </span>
                    ) : game ? (
                      <Link href={`/game/${game.id}`} className="text-xs px-2 py-1 rounded bg-ccb-primary/10 text-ccb-primary hover:bg-ccb-primary/20 transition-colors">
                        Watch →
                      </Link>
                    ) : (
                      <CircleDot className="w-4 h-4 text-ccb-muted" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

            {/* Standings / Participant List */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-ccb-accent" />
            {tournament.status === "finished"
              ? "Final Standings"
              : tournament.status === "active"
              ? "Current Standings"
              : "Registered Participants"}
          </h2>
          <span className="text-xs text-ccb-muted">
            {participants.length} player{participants.length === 1 ? "" : "s"}
          </span>
        </div>

        {sortedParticipants.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ccb-surface text-xs text-ccb-muted uppercase">
                  <th className="py-3 px-3 w-16">
                    {tournament.status === "upcoming" ? "Seed" : "Rank"}
                  </th>
                  <th className="py-3 px-3">Player</th>
                  <th className="py-3 px-3 text-right">Rating</th>
                  {tournament.status !== "upcoming" && (
                    <>
                      <th className="py-3 px-3 text-center">Played</th>
                      <th className="py-3 px-3 text-center">W / D / L</th>
                      <th className="py-3 px-3 text-right font-bold">Score</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ccb-surface">
                {sortedParticipants.map((p, index) => {
                  const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
                  const displayName =
                    profile?.display_name || profile?.username || "Anonymous Player";
                  const rating = profile?.rating ?? 1500;
                  const rank = p.final_rank || index + 1;
                  const isWinner =
                    (tournament.status === "finished" && rank === 1) ||
                    (tournament.status === "active" && index === 0 && p.score > 0);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-ccb-surface/50 transition-colors ${
                        isWinner ? "bg-ccb-accent/5 font-medium" : ""
                      }`}
                    >
                      {/* Seed or Rank */}
                      <td className="py-3 px-3 font-semibold">
                        {tournament.status === "upcoming" ? (
                          <span className="text-ccb-muted">#{p.seed || index + 1}</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            {isWinner && <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />}
                            <span>#{rank}</span>
                          </div>
                        )}
                      </td>

                      {/* Player profile */}
                      <td className="py-3 px-3">
                        <Link
                          href={profile?.username ? `/profile/${profile.username}` : "#"}
                          className="flex items-center gap-2.5 hover:text-ccb-primary transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-full bg-ccb-surface border border-ccb-muted/20 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {profile?.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt={displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-semibold flex items-center gap-1.5">
                              <span>{displayName}</span>
                              {isWinner && (
                                <span className="badge bg-amber-400/10 text-amber-400 text-[10px] px-1.5 py-0.5">
                                  Winner
                                </span>
                              )}
                            </div>
                            {profile?.username && (
                              <div className="text-xs text-ccb-muted font-normal">
                                @{profile.username}
                              </div>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* Rating */}
                      <td className="py-3 px-3 text-right font-mono text-ccb-muted">
                        {rating}
                      </td>

                      {/* Stats if active or finished */}
                      {tournament.status !== "upcoming" && (
                        <>
                          <td className="py-3 px-3 text-center font-mono">
                            {p.games_played}
                          </td>
                          <td className="py-3 px-3 text-center text-xs font-mono text-ccb-muted">
                            <span className="text-ccb-success">{p.wins}</span> /{" "}
                            <span className="text-ccb-silver">{p.draws}</span> /{" "}
                            <span className="text-ccb-danger">{p.losses}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold font-mono text-ccb-primary">
                            {p.score}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-ccb-muted">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No players joined yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
