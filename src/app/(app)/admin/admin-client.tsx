"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, ArrowDownUp, Trophy, Loader2, Check, X, Coins,
  TrendingUp, Wallet, AlertCircle, ChevronRight, Cherry, Gift
} from "lucide-react";

interface Withdrawal {
  id: string;
  amount_cents: number;
  phone: string;
  operator_name: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  user_id: string;
  profiles: { username: string; display_name: string; email: string } | null;
}

interface Stats {
  totalUsers: number;
  gamesToday: number;
  activeTournaments: number;
  pendingWithdrawals: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalPrizePools: number;
  walletLiquidity: number;
}

interface UserInfo {
  id: string;
  username: string;
  display_name: string;
  email: string;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  wallet_balance_cents: number;
  is_admin: boolean;
  phone: string | null;
  created_at: string;
}

type Tab = "overview" | "withdrawals" | "users" | "battles" | "berry";

export default function AdminDashboard({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState("pending");
  const [battleStats, setBattleStats] = useState<any>(null);
  const [battleConfig, setBattleConfig] = useState<any>(null);
  const [berryConfig, setBerryConfig] = useState<any>(null);
  const [berrySaving, setBerrySaving] = useState(false);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    const data = await res.json();
    setStats(data);
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    const res = await fetch(`/api/admin/withdrawals?status=${filter}`);
    const data = await res.json();
    setWithdrawals(data.withdrawals || []);
  }, [filter]);

  const fetchBerryConfig = useCallback(async () => {
    const res = await fetch("/api/admin/berry-config");
    if (res.ok) setBerryConfig(await res.json());
  }, []);

  const fetchBattleStats = useCallback(async () => {
    const [statsRes, configRes] = await Promise.all([
      fetch("/api/battles/stats"),
      fetch("/api/battles/config"),
    ]);
    if (statsRes.ok) setBattleStats(await statsRes.json());
    if (configRes.ok) setBattleConfig(await configRes.json());
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchStats();
      if (tab === "withdrawals") await fetchWithdrawals();
      if (tab === "users") await fetchUsers();
      if (tab === "battles") await fetchBattleStats();
      if (tab === "berry") await fetchBerryConfig();
      setLoading(false);
    };
    load();
  }, [tab, filter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      setWithdrawals((prev) => prev.filter((w) => w.id !== id));
      await fetchStats();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const notes = prompt("Reason for rejection (optional):") || "Rejected by admin";
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      setWithdrawals((prev) => prev.filter((w) => w.id !== id));
      await fetchStats();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const formatMWK = (cents: number) => `MWK ${Math.floor((cents || 0) / 100).toLocaleString()}`;

  const tabs = [
    { id: "overview" as Tab, label: "Overview", icon: LayoutDashboard },
    { id: "withdrawals" as Tab, label: "Withdrawals", icon: ArrowDownUp, badge: stats?.pendingWithdrawals },
    { id: "users" as Tab, label: "Users", icon: Users },
    { id: "battles" as Tab, label: "Battles", icon: Coins },
    { id: "berry" as Tab, label: "Berry", icon: Cherry },
  ];

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-ccb-muted mt-1">Welcome back, {adminName}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.id
                  ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary"
                  : "border-ccb-surface text-ccb-muted hover:border-ccb-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.badge ? (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-ccb-accent/20 text-ccb-accent text-xs font-bold">
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-ccb-muted" />
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          {tab === "overview" && stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <StatCard icon={Users} label="Total Users" value={stats.totalUsers || 0} color="text-ccb-primary" />
                <StatCard icon={Trophy} label="Active Tournaments" value={stats.activeTournaments || 0} color="text-ccb-accent" />
                <StatCard icon={TrendingUp} label="Games Today" value={stats.gamesToday || 0} color="text-ccb-success" />
                <StatCard icon={AlertCircle} label="Pending Withdrawals" value={stats.pendingWithdrawals || 0} color="text-ccb-danger" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4">
                <StatCard icon={ArrowDownUp} label="Total Deposits" value={formatMWK(stats.totalDeposits)} color="text-ccb-success" />
                <StatCard icon={ArrowDownUp} label="Total Withdrawals" value={formatMWK(stats.totalWithdrawals)} color="text-ccb-accent" />
                <StatCard icon={Wallet} label="Wallet Liquidity" value={formatMWK(stats.walletLiquidity)} color="text-ccb-primary" />
              </div>

              <div className="card">
                <h3 className="font-medium text-sm text-ccb-muted uppercase tracking-wide mb-3">Platform Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ccb-muted">Total Tournament Prize Pools</span>
                    <span className="font-medium">{formatMWK(stats.totalPrizePools)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ccb-muted">Net Flow (Deposits - Withdrawals)</span>
                    <span className="font-medium text-ccb-success">{formatMWK(stats.totalDeposits - stats.totalWithdrawals)}</span>
                  </div>
                </div>
              </div>

              {stats.pendingWithdrawals > 0 && (
                <button
                  onClick={() => setTab("withdrawals")}
                  className="card w-full flex items-center justify-between p-4 border-ccb-accent/30 hover:border-ccb-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-ccb-accent" />
                    <span className="font-medium">{stats.pendingWithdrawals} pending withdrawal{stats.pendingWithdrawals !== 1 ? "s" : ""} need review</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ccb-muted" />
                </button>
              )}
            </div>
          )}

          {/* WITHDRAWALS */}
          {tab === "withdrawals" && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex gap-2">
                {["pending", "completed", "rejected", "all"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                      filter === f
                        ? "bg-ccb-primary/10 text-ccb-primary border border-ccb-primary/30"
                        : "text-ccb-muted hover:text-ccb-text border border-transparent"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {withdrawals.length === 0 ? (
                <div className="text-center py-12 text-ccb-muted text-sm">
                  <ArrowDownUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No {filter} withdrawals
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="card space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-ccb-accent/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-ccb-accent" />
                          </div>
                          <div>
                            <div className="font-medium">{formatMWK(w.amount_cents)}</div>
                            <div className="text-xs text-ccb-muted">
                              {w.profiles?.username || "Unknown"} · {w.profiles?.email || ""}
                            </div>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          w.status === "completed" ? "bg-ccb-success/10 text-ccb-success" :
                          w.status === "pending" ? "bg-ccb-accent/10 text-ccb-accent" :
                          w.status === "approved" ? "bg-ccb-primary/10 text-ccb-primary" :
                          "bg-ccb-danger/10 text-ccb-danger"
                        }`}>
                          {w.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-ccb-muted">
                        <div>
                          <span className="opacity-70">Phone:</span> {w.phone}
                        </div>
                        <div>
                          <span className="opacity-70">Operator:</span> {w.operator_name}
                        </div>
                        <div>
                          <span className="opacity-70">Requested:</span> {new Date(w.created_at).toLocaleString()}
                        </div>
                        {w.admin_notes && (
                          <div className="col-span-2">
                            <span className="opacity-70">Notes:</span> {w.admin_notes}
                          </div>
                        )}
                      </div>

                      {w.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(w.id)}
                            disabled={actionLoading === w.id}
                            className="flex-1 btn-primary py-2 flex items-center justify-center gap-2 text-sm"
                          >
                            {actionLoading === w.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                Approve & Send
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(w.id)}
                            disabled={actionLoading === w.id}
                            className="flex-1 py-2 rounded-lg border border-ccb-danger/30 text-ccb-danger hover:bg-ccb-danger/10 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                          >
                            <X className="w-4 h-4" />
                            Reject & Refund
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BATTLES */}
          {tab === "battles" && battleStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <StatCard icon={Coins} label="Active Battles" value={battleStats.stats.activeBattles || 0} color="text-ccb-primary" />
                <StatCard icon={Users} label="In Queue" value={battleStats.stats.waitingPlayers || 0} color="text-ccb-accent" />
                <StatCard icon={Trophy} label="Completed" value={battleStats.stats.completedBattles || 0} color="text-ccb-success" />
                <StatCard icon={AlertCircle} label="Disputed" value={battleStats.stats.disputedBattles || 0} color="text-ccb-danger" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4">
                <StatCard icon={Coins} label="Total Volume" value={formatMWK(battleStats.stats.totalVolume || 0)} color="text-ccb-success" />
                <StatCard icon={Coins} label="Platform Revenue" value={formatMWK(battleStats.stats.totalRevenue || 0)} color="text-ccb-accent" />
                <StatCard icon={Wallet} label="Locked Funds" value={formatMWK(battleStats.stats.lockedFunds || 0)} color="text-ccb-danger" />
              </div>

              {battleConfig && (
                <div className="card">
                  <h3 className="font-medium text-sm text-ccb-muted uppercase tracking-wide mb-3">Battle Configuration</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ccb-muted">Enabled</span>
                      <span className="font-medium">{battleConfig.enabled ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ccb-muted">Platform Fee</span>
                      <span className="font-medium">{battleConfig.platform_fee_pct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ccb-muted">Rating Range</span>
                      <span className="font-medium">+/- {battleConfig.rating_range}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ccb-muted">Time Control</span>
                      <span className="font-medium">{battleConfig.initial_minutes}+{battleConfig.increment_seconds}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ccb-muted">Armageddon</span>
                      <span className="font-medium">{battleConfig.armageddon_pct}% time, max {battleConfig.max_armageddon_rounds} rounds</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ccb-muted">Queue Timeout</span>
                      <span className="font-medium">{battleConfig.queue_timeout_s}s</span>
                    </div>
                  </div>
                </div>
              )}

              {battleStats.recentBattles && battleStats.recentBattles.length > 0 && (
                <div className="card">
                  <h3 className="font-medium text-sm text-ccb-muted uppercase tracking-wide mb-3">Recent Battles</h3>
                  <div className="space-y-2">
                    {battleStats.recentBattles.map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between text-sm py-2 border-b border-ccb-border last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-ccb-muted">{b.white_player?.username || "?"} vs {b.black_player?.username || "?"}</span>
                          {b.armageddon_round > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-ccb-accent/10 text-ccb-accent">AG{b.armageddon_round}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{formatMWK(b.stake_cents)}</span>
                          <span className={"text-xs px-2 py-1 rounded " + (
                            b.status === "completed" ? "bg-ccb-success/10 text-ccb-success" :
                            b.status === "playing" || b.status === "draw_armageddon" ? "bg-ccb-accent/10 text-ccb-accent" :
                            b.status === "disputed" ? "bg-ccb-danger/10 text-ccb-danger" :
                            "bg-ccb-muted/10 text-ccb-muted"
                          )}>{b.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BERRY CONFIG */}
          {tab === "berry" && berryConfig && (
            <div className="space-y-4">
              <div className="card space-y-4">
                <div className="flex items-center gap-2">
                  <Cherry className="w-5 h-5 text-red-500" />
                  <h3 className="font-medium">CRAZYCHESSBERRY Settings</h3>
                </div>

                <div>
                  <label className="text-sm text-ccb-muted mb-1 block">Berries per Win</label>
                  <input
                    type="number"
                    value={berryConfig.berries_per_win ?? 10}
                    onChange={(e) => setBerryConfig({ ...berryConfig, berries_per_win: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-ccb-surface border border-ccb-border text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm text-ccb-muted mb-1 block">Berries per Draw</label>
                  <input
                    type="number"
                    value={berryConfig.berries_per_draw ?? 2}
                    onChange={(e) => setBerryConfig({ ...berryConfig, berries_per_draw: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-ccb-surface border border-ccb-border text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm text-ccb-muted mb-1 block">Berry Value (MWK cents per 100 berries)</label>
                  <input
                    type="number"
                    value={berryConfig.berry_value_cents ?? 1000}
                    onChange={(e) => setBerryConfig({ ...berryConfig, berry_value_cents: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-ccb-surface border border-ccb-border text-sm"
                  />
                  <p className="text-xs text-ccb-muted mt-1">100 berries = MWK {(berryConfig.berry_value_cents ?? 1000) / 100}</p>
                </div>

                <div>
                  <label className="text-sm text-ccb-muted mb-1 block">Minimum Redemption (berries)</label>
                  <input
                    type="number"
                    value={berryConfig.min_redemption ?? 1000}
                    onChange={(e) => setBerryConfig({ ...berryConfig, min_redemption: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-ccb-surface border border-ccb-border text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={berryConfig.enabled ?? true}
                    onChange={(e) => setBerryConfig({ ...berryConfig, enabled: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label className="text-sm">Berry earning enabled</label>
                </div>

                <button
                  onClick={async () => {
                    setBerrySaving(true);
                    try {
                      const res = await fetch("/api/admin/berry-config", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(berryConfig),
                      });
                      if (res.ok) {
                        const updated = await res.json();
                        setBerryConfig(updated);
                        alert("Berry config saved!");
                      } else {
                        const data = await res.json();
                        alert(data.error || "Failed to save");
                      }
                    } catch (e) {
                      alert("Failed to save");
                    } finally {
                      setBerrySaving(false);
                    }
                  }}
                  disabled={berrySaving}
                  className="w-full py-2.5 rounded-lg bg-ccb-primary text-white text-sm font-medium hover:bg-ccb-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {berrySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Berry Config
                </button>
              </div>
            </div>
          )}

          {/* USERS */}
          {tab === "users" && (
            <div className="space-y-3">
              {users.length === 0 ? (
                <div className="text-center py-12 text-ccb-muted text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No users found
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="card flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-ccb-surface border border-ccb-border flex items-center justify-center">
                          <span className="text-sm font-bold text-ccb-primary">
                            {(u.display_name || u.username || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium flex items-center gap-2">
                            {u.display_name || u.username}
                            {u.is_admin && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-ccb-primary/20 text-ccb-primary font-bold">ADMIN</span>
                            )}
                          </div>
                          <div className="text-xs text-ccb-muted">{u.email}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatMWK(u.wallet_balance_cents)}</div>
                        <div className="text-xs text-ccb-muted">
                          {u.rating || "Unrated"} · {u.games_played || 0} games
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-ccb-muted">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
