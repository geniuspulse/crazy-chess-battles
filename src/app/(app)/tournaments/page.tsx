import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Trophy, Plus, Users, Clock } from "lucide-react";

export default async function TournamentsPage() {
  const supabase = createClient();

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, description, type, time_control, status, starts_at, max_players, duration_minutes, rounds")
    .order("starts_at", { ascending: false })
    .limit(20);

  const statusColors: Record<string, string> = {
    upcoming: "text-ccb-accent bg-ccb-accent/10",
    active: "text-ccb-success bg-ccb-success/10",
    finished: "text-ccb-muted bg-ccb-surface",
    cancelled: "text-ccb-danger bg-ccb-danger/10",
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-sm text-ccb-muted mt-1">Compete for glory</p>
        </div>
      </div>

      {tournaments && tournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="card hover:border-ccb-primary transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-ccb-accent/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-ccb-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold">{t.name}</h3>
                    <span className={`badge ${statusColors[t.status]} capitalize`}>{t.status}</span>
                  </div>
                </div>
              </div>

              {t.description && (
                <p className="text-sm text-ccb-muted mb-3 line-clamp-2">{t.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-ccb-muted">
                <span className="flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  {t.type}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t.time_control}
                </span>
                {t.max_players && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {t.max_players} max
                  </span>
                )}
              </div>

              <div className="mt-3 text-xs text-ccb-muted">
                {new Date(t.starts_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </Link>
          ))}
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
