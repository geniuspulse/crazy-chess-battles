import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Swords, Trophy, TrendingUp, Clock, Wallet } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { data: recentGames } = await supabase
    .from("games")
    .select("id, status, winner, time_control, created_at, ended_at, white_player_id, black_player_id")
    .or(`white_player_id.eq.${user!.id},black_player_id.eq.${user!.id}`)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: activeTournaments } = await supabase
    .from("tournaments")
    .select("id, name, type, status, starts_at")
    .eq("status", "upcoming")
    .order("starts_at", { ascending: true })
    .limit(3);

  const winRate = profile?.games_played
    ? Math.round(((profile.wins ?? 0) / profile.games_played) * 100)
    : 0;

  const walletBalance = profile?.wallet_balance_cents
    ? `MK ${Math.floor(profile.wallet_balance_cents / 100).toLocaleString("en-US")}`
    : "MK 0";

  const stats = [
    { label: "Rating", value: profile?.rating ?? "—", icon: TrendingUp, color: "text-ccb-primary" },
    { label: "Games", value: profile?.games_played ?? 0, icon: Swords, color: "text-ccb-text" },
    { label: "Win Rate", value: `${winRate}%`, icon: Clock, color: "text-ccb-success" },
    { label: "Wallet", value: walletBalance, icon: Wallet, color: "text-ccb-accent" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-0">
      {/* Welcome */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">
          Welcome back, {profile?.display_name || profile?.username || "Player"}
        </h1>
        <p className="text-sm text-ccb-muted mt-1">Ready for a battle?</p>
      </div>

      {/* Stats grid — 2x2 on mobile, 4 across on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ccb-muted">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className={`text-lg sm:text-2xl font-bold ${stat.color} truncate`}>{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Quick play CTA */}
      <Link href="/play" className="block card card-hover group p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-ccb-primary/10 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-ccb-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg">Quick Match</h3>
              <p className="text-xs sm:text-sm text-ccb-muted truncate">Find an opponent and start playing</p>
            </div>
          </div>
          <div className="text-ccb-primary group-hover:translate-x-1 transition-transform shrink-0 ml-2">→</div>
        </div>
      </Link>

      {/* Wallet CTA */}
      <Link href="/wallet" className="block card card-hover group p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-ccb-accent/10 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-ccb-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg">Wallet</h3>
              <p className="text-xs sm:text-sm text-ccb-muted truncate">Balance: {walletBalance}</p>
            </div>
          </div>
          <div className="text-ccb-primary group-hover:translate-x-1 transition-transform shrink-0 ml-2">→</div>
        </div>
      </Link>

      {/* Recent games + Tournaments — stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent games */}
        <div className="card p-3 sm:p-4">
          <h3 className="font-bold mb-3 text-base sm:text-lg">Recent Games</h3>
          {recentGames && recentGames.length > 0 ? (
            <div className="space-y-2">
              {recentGames.map((game) => {
                const isWhite = game.white_player_id === user!.id;
                const won = game.winner === (isWhite ? "white" : "black");
                const drew = game.status === "draw";
                const result = won ? "W" : drew ? "D" : "L";
                const resultColor = won ? "text-ccb-success" : drew ? "text-ccb-silver" : "text-ccb-danger";

                return (
                  <Link
                    key={game.id}
                    href={`/game/${game.id}`}
                    className="flex items-center justify-between rounded-lg bg-ccb-surface px-3 py-2 sm:px-4 sm:py-3 hover:bg-ccb-card transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${resultColor}`}>{result}</span>
                      <span className="text-sm capitalize">{game.time_control}</span>
                    </div>
                    <span className="text-xs text-ccb-muted">
                      {new Date(game.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ccb-muted">No games yet. Start playing!</p>
          )}
        </div>

        {/* Upcoming tournaments */}
        <div className="card p-3 sm:p-4">
          <h3 className="font-bold mb-3 text-base sm:text-lg">Upcoming Tournaments</h3>
          {activeTournaments && activeTournaments.length > 0 ? (
            <div className="space-y-2">
              {activeTournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="flex items-center justify-between rounded-lg bg-ccb-surface px-3 py-2 sm:px-4 sm:py-3 hover:bg-ccb-card transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-xs text-ccb-muted capitalize">{t.type}</div>
                  </div>
                  <span className="text-xs text-ccb-muted shrink-0 ml-2">
                    {new Date(t.starts_at).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ccb-muted">No upcoming tournaments. Check back soon!</p>
          )}
        </div>
      </div>
    </div>
  );
}
