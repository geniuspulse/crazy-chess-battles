export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Trophy, Plus, Users, Clock, Coins, Award } from "lucide-react";

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

export default async function TournamentsPage() {
  const supabase = await createClient();

  // Get user + admin status
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select(`
      id,
      name,
      description,
      type,
      time_control,
      status,
      starts_at,
      max_players,
      duration_minutes,
      rounds,
      entry_fee_cents,
      prize_pool_cents,
      tournament_participants(count)
    `)
    .order("starts_at", { ascending: false })
    .limit(20);

  const statusColors: Record<string, string> = {
    upcoming: "text-ccb-accent bg-ccb-accent/10 border-ccb-accent/20",
    active: "text-ccb-success bg-ccb-success/10 border-ccb-success/20",
    finished: "text-ccb-muted bg-ccb-surface border-ccb-muted/20",
    cancelled: "text-ccb-danger bg-ccb-danger/10 border-ccb-danger/20",
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-sm text-ccb-muted mt-1">Compete for glory and prizes</p>
        </div>
        {isAdmin && (
          <Link
            href="/tournaments/create"
            className="btn-primary inline-flex items-center gap-2 text-sm px-3 sm:px-4"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Tournament</span>
          </Link>
        )}
      </div>

      {tournaments && tournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournaments.map((t) => {
            const participantCount = Array.isArray(t.tournament_participants)
              ? (t.tournament_participants[0]?.count ?? t.tournament_participants.length)
              : 0;

            return (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="card card-hover group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-ccb-accent/10 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-ccb-accent" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base group-hover:text-ccb-primary transition-colors">
                          {t.name}
                        </h3>
                        <span
                          className={`badge border ${
                            statusColors[t.status] || "text-ccb-muted bg-ccb-surface"
                          } capitalize text-[11px]`}
                        >
                          {t.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {t.description && (
                    <p className="text-sm text-ccb-muted mb-4 line-clamp-2">{t.description}</p>
                  )}

                  {/* Financials & Player Count Grid */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-ccb-surface/60 text-xs mb-4">
                    <div>
                      <div className="text-ccb-muted flex items-center gap-1 mb-0.5">
                        <Coins className="w-3 h-3" />
                        <span>Entry</span>
                      </div>
                      <div className="font-semibold text-ccb-text">
                        {formatMoney(t.entry_fee_cents)}
                      </div>
                    </div>

                    <div>
                      <div className="text-ccb-muted flex items-center gap-1 mb-0.5">
                        <Award className="w-3 h-3 text-ccb-accent" />
                        <span>Prize</span>
                      </div>
                      <div className="font-semibold text-ccb-accent">
                        {formatPrizePool(t.prize_pool_cents)}
                      </div>
                    </div>

                    <div>
                      <div className="text-ccb-muted flex items-center gap-1 mb-0.5">
                        <Users className="w-3 h-3" />
                        <span>Players</span>
                      </div>
                      <div className="font-semibold text-ccb-text">
                        {participantCount}
                        {t.max_players ? ` / ${t.max_players}` : ""}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-ccb-muted pt-3 border-t border-ccb-surface">
                  <div className="flex items-center gap-3">
                    <span className="capitalize font-medium">{t.type}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 capitalize">
                      <Clock className="w-3 h-3" />
                      {t.time_control}
                    </span>
                  </div>

                  <span>
                    {new Date(t.starts_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Trophy className="w-12 h-12 text-ccb-muted mx-auto mb-4" />
          <h3 className="font-medium mb-1">No tournaments yet</h3>
          <p className="text-sm text-ccb-muted">Tournaments will appear here once scheduled.</p>
        </div>
      )}
    </div>
  );
}
