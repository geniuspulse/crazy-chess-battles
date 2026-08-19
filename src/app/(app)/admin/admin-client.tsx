"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, ArrowDownUp, Trophy, Loader2, Check, X, Coins,
  TrendingUp, Wallet, AlertCircle, ChevronRight, Cherry, Gamepad2,
  Shield, Ban, Star, DollarSign, Search, Save, ScrollText, Swords,
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
  is_banned: boolean;
  phone: string | null;
  berry_balance: number;
  created_at: string;
}

interface Deposit {
  id: string;
  user_id: string;
  amount_cents: number;
  status: string;
  method: string;
  charge_id: string | null;
  tx_ref: string | null;
  phone: string | null;
  reference: string | null;
  created_at: string;
}

interface Tournament {
  id: string;
  name: string;
  format: string;
  status: string;
  entry_fee_cents: number;
  prize_pool_cents: number;
  max_players: number;
  current_round: number;
  total_rounds: number;
  starts_at: string;
  created_at: string;
  participant_count: number;
}

interface GameInfo {
  id: string;
  status: string;
  time_control: string;
  rated: boolean;
  white_username: string;
  black_username: string;
  white_rating: number;
  black_rating: number;
  winner: string | null;
  created_at: string;
  move_count: number;
}

interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  created_at: string;
  profiles: { username: string; display_name: string } | null;
}

type Tab = "overview" | "users" | "withdrawals" | "tournaments" | "games" | "deposits" | "battles" | "berry" | "logs";

export default function AdminDashboard({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState("pending");
  const [battleStats, setBattleStats] = useState<any>(null);
  const [battleConfig, setBattleConfig] = useState<any>(null);
  const [battleConfigSaving, setBattleConfigSaving] = useState(false);
  const [berryConfig, setBerryConfig] = useState<any>(null);
  const [berrySaving, setBerrySaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

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

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
  }, []);

  const fetchDeposits = useCallback(async () => {
    const res = await fetch(`/api/admin/deposits?status=${filter}`);
    const data = await res.json();
    setDeposits(data.deposits || []);
  }, [filter]);

  const fetchTournaments = useCallback(async () => {
    const res = await fetch("/api/admin/tournaments");
    const data = await res.json();
    setTournaments(data.tournaments || []);
  }, []);

  const fetchGames = useCallback(async () => {
    const res = await fetch(`/api/admin/games?status=${filter}`);
    const data = await res.json();
    setGames(data.games || []);
  }, [filter]);

  const fetchLogs = useCallback(async () => {
    const res = await fetch("/api/admin/logs");
    const data = await res.json();
    setLogs(data.logs || []);
  }, []);

  const fetchBerryConfig = useCallback(async () => {
    const res = await fetch("/api/admin/berry-config");
    if (res.ok) setBerryConfig(await res.json());
  }, []);

  const fetchBattleStats = useCallback(async () => {
    const [statsRes, configRes] = await Promise.all([
      fetch("/api/battles/stats"),
      fetch("/api/admin/battle-config"),
    ]);
    if (statsRes.ok) setBattleStats(await statsRes.json());
    if (configRes.ok) setBattleConfig(await configRes.json());
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchStats();
      if (tab === "withdrawals") await fetchWithdrawals();
      if (tab === "users") await fetchUsers();
      if (tab === "deposits") await fetchDeposits();
      if (tab === "tournaments") await fetchTournaments();
      if (tab === "games") await fetchGames();
      if (tab === "logs") await fetchLogs();
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
      showToast("Withdrawal approved");
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
      showToast("Withdrawal rejected");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUserAction = async (userId: string, action: string, value?: any) => {
    setActionLoading(`${userId}_${action}`);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await fetchUsers();
      if (selectedUser?.id === userId) {
        // Update selected user
        const updated = users.find(u => u.id === userId);
        if (updated) setSelectedUser({ ...updated, ...value === true ? { is_admin: true } : {} });
      }
      showToast(`User ${action} successful`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTournamentAction = async (tournamentId: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} this tournament?`)) return;
    setActionLoading(`${tournamentId}_${action}`);
    try {
      const res = await fetch("/api/admin/tournaments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await fetchTournaments();
      showToast(`Tournament ${action} successful`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGameAbort = async (gameId: string) => {
    if (!confirm("Abort this game? This cannot be undone.")) return;
    setActionLoading(gameId);
    try {
      const res = await fetch("/api/admin/games", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, action: "abort" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await fetchGames();
      showToast("Game aborted");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const saveBattleConfig = async () => {
    setBattleConfigSaving(true);
    try {
      const res = await fetch("/api/admin/battle-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(battleConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setBattleConfig(data);
      showToast("Battle config saved");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBattleConfigSaving(false);
    }
  };

  const formatMWK = (cents: number) => `MWK ${Math.floor((cents || 0) / 100).toLocaleString()}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return !q || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q);
  });

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "users", label: "Users", icon: Users },
    { id: "withdrawals", label: "Withdrawals", icon: ArrowDownUp, badge: stats?.pendingWithdrawals },
    { id: "tournaments", label: "Tournaments", icon: Trophy },
    { id: "games", label: "Games", icon: Gamepad2 },
    { id: "deposits", label: "Deposits", icon: DollarSign },
    { id: "battles", label: "Battles", icon: Swords },
    { id: "berry", label: "Berry", icon: Cherry },
    { id: "logs", label: "Logs", icon: ScrollText },
  ];

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-ccb-success text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}

      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-ccb-primary" /> Admin Dashboard
        </h1>
        <p className="text-sm text-ccb-muted mt-1">Welcome back, {adminName}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setFilter("pending"); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${
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
                <StatCard icon={DollarSign} label="Total Deposits" value={formatMWK(stats.totalDeposits)} color="text-ccb-success" />
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

          {/* USERS */}
          {tab === "users" && (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ccb-muted" />
                <input
                  type="text"
                  placeholder="Search users by name, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-ccb-surface border border-ccb-border text-sm"
                />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-ccb-muted text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No users found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className={`card ${u.is_banned ? "opacity-60" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-ccb-surface border border-ccb-border flex items-center justify-center">
                            <span className="text-sm font-bold text-ccb-primary">
                              {(u.display_name || u.username || "?").charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium flex items-center gap-2">
                              {u.display_name || u.username}
                              {u.is_admin && <span className="text-xs px-1.5 py-0.5 rounded bg-ccb-primary/20 text-ccb-primary font-bold">ADMIN</span>}
                              {u.is_banned && <span className="text-xs px-1.5 py-0.5 rounded bg-ccb-danger/20 text-ccb-danger font-bold">BANNED</span>}
                            </div>
                            <div className="text-xs text-ccb-muted">{u.email} · {u.rating || "Unrated"} elo · {u.games_played || 0} games</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatMWK(u.wallet_balance_cents)}</div>
                          <div className="text-xs text-ccb-muted flex items-center gap-1 justify-end">
                            <Cherry className="w-3 h-3 text-red-500" /> {u.berry_balance || 0}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-ccb-border">
                        <ActionButton
                          onClick={() => handleUserAction(u.id, u.is_banned ? "unban" : "ban")}
                          loading={actionLoading === `${u.id}_${u.is_banned ? "unban" : "ban"}`}
                          variant={u.is_banned ? "success" : "danger"}
                        >
                          <Ban className="w-3.5 h-3.5" /> {u.is_banned ? "Unban" : "Ban"}
                        </ActionButton>

                        <ActionButton
                          onClick={() => handleUserAction(u.id, "toggle_admin", !u.is_admin)}
                          loading={actionLoading === `${u.id}_toggle_admin`}
                          variant="primary"
                        >
                          <Shield className="w-3.5 h-3.5" /> {u.is_admin ? "Remove Admin" : "Make Admin"}
                        </ActionButton>

                        <ActionButton
                          onClick={() => {
                            const val = prompt("Adjust wallet (positive=credit, negative=debit, in MWK cents):", "1000");
                            if (val !== null) handleUserAction(u.id, "adjust_wallet", parseInt(val));
                          }}
                          loading={actionLoading === `${u.id}_adjust_wallet`}
                          variant="default"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Wallet
                        </ActionButton>

                        <ActionButton
                          onClick={() => {
                            const val = prompt("Set new rating (0-4000):", String(u.rating || 1500));
                            if (val !== null) handleUserAction(u.id, "adjust_rating", parseInt(val));
                          }}
                          loading={actionLoading === `${u.id}_adjust_rating`}
                          variant="default"
                        >
                          <Star className="w-3.5 h-3.5" /> Rating
                        </ActionButton>

                        <ActionButton
                          onClick={() => {
                            const val = prompt("Grant berries:", "100");
                            if (val !== null) handleUserAction(u.id, "grant_berries", parseInt(val));
                          }}
                          loading={actionLoading === `${u.id}_grant_berries`}
                          variant="default"
                        >
                          <Cherry className="w-3.5 h-3.5" /> Grant Berries
                        </ActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WITHDRAWALS */}
          {tab === "withdrawals" && (
            <div className="space-y-4">
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
                  No withdrawals found
                </div>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="card">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">
                            {w.profiles?.display_name || w.profiles?.username || "Unknown"}
                          </div>
                          <div className="text-xs text-ccb-muted">
                            {w.profiles?.email} · {w.phone} · {w.operator_name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{formatMWK(w.amount_cents)}</div>
                          <div className="text-xs text-ccb-muted">{formatDate(w.created_at)}</div>
                        </div>
                      </div>
                      {w.status === "pending" && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-ccb-border">
                          <button
                            onClick={() => handleApprove(w.id)}
                            disabled={actionLoading === w.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-ccb-success text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            {actionLoading === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(w.id)}
                            disabled={actionLoading === w.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-ccb-danger text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TOURNAMENTS */}
          {tab === "tournaments" && (
            <div className="space-y-3">
              {tournaments.length === 0 ? (
                <div className="text-center py-12 text-ccb-muted text-sm">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No tournaments found
                </div>
              ) : (
                <div className="space-y-2">
                  {tournaments.map((t) => (
                    <div key={t.id} className="card">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium flex items-center gap-2">
                            {t.name}
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              t.status === "active" ? "bg-ccb-success/10 text-ccb-success" :
                              t.status === "upcoming" ? "bg-ccb-accent/10 text-ccb-accent" :
                              t.status === "finished" ? "bg-ccb-muted/10 text-ccb-muted" :
                              t.status === "cancelled" ? "bg-ccb-danger/10 text-ccb-danger" :
                              "bg-ccb-surface text-ccb-muted"
                            }`}>{t.status}</span>
                          </div>
                          <div className="text-xs text-ccb-muted mt-1">
                            {t.format} · {t.participant_count}/{t.max_players} players · Round {t.current_round}/{t.total_rounds}
                          </div>
                          <div className="text-xs text-ccb-muted">
                            Entry: {formatMWK(t.entry_fee_cents)} · Prize: {formatMWK(t.prize_pool_cents)}
                          </div>
                        </div>
                        <div className="text-xs text-ccb-muted text-right">
                          {formatDate(t.starts_at)}
                        </div>
                      </div>
                      {(t.status === "upcoming" || t.status === "active") && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-ccb-border">
                          <button
                            onClick={() => handleTournamentAction(t.id, "cancel")}
                            disabled={actionLoading === `${t.id}_cancel`}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-ccb-danger/90 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            {actionLoading === `${t.id}_cancel` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            Cancel & Refund
                          </button>
                          {t.status === "active" && (
                            <button
                              onClick={() => handleTournamentAction(t.id, "force_finish")}
                              disabled={actionLoading === `${t.id}_force_finish`}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-ccb-accent/90 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                            >
                              {actionLoading === `${t.id}_force_finish` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              Force Finish
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GAMES */}
          {tab === "games" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {["all", "playing", "completed", "aborted", "draw"].map((f) => (
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

              {games.length === 0 ? (
                <div className="text-center py-12 text-ccb-muted text-sm">
                  <Gamepad2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No games found
                </div>
              ) : (
                <div className="space-y-2">
                  {games.map((g) => (
                    <div key={g.id} className="card flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          {g.white_username} ({g.white_rating}) vs {g.black_username} ({g.black_rating})
                        </div>
                        <div className="text-xs text-ccb-muted mt-1">
                          {g.time_control} · {g.rated ? "Rated" : "Casual"} · {g.move_count} moves · {formatDate(g.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          g.status === "playing" ? "bg-ccb-success/10 text-ccb-success" :
                          g.status === "completed" ? "bg-ccb-muted/10 text-ccb-muted" :
                          g.status === "aborted" ? "bg-ccb-danger/10 text-ccb-danger" :
                          "bg-ccb-surface text-ccb-muted"
                        }`}>{g.status}</span>
                        {g.winner && <span className="text-xs text-ccb-muted">{g.winner} won</span>}
                        {g.status === "playing" && (
                          <button
                            onClick={() => handleGameAbort(g.id)}
                            disabled={actionLoading === g.id}
                            className="text-xs px-2 py-1 rounded bg-ccb-danger/10 text-ccb-danger hover:bg-ccb-danger/20 disabled:opacity-50"
                          >
                            {actionLoading === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Abort"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DEPOSITS */}
          {tab === "deposits" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {["all", "success", "pending", "failed"].map((f) => (
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

              {deposits.length === 0 ? (
                <div className="text-center py-12 text-ccb-muted text-sm">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No deposits found
                </div>
              ) : (
                <div className="space-y-2">
                  {deposits.map((d) => (
                    <div key={d.id} className="card flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{formatMWK(d.amount_cents)}</div>
                        <div className="text-xs text-ccb-muted mt-1">
                          {d.method} · {d.phone || "N/A"} · {formatDate(d.created_at)}
                        </div>
                        {d.reference && <div className="text-xs text-ccb-muted">Ref: {d.reference}</div>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        d.status === "success" ? "bg-ccb-success/10 text-ccb-success" :
                        d.status === "pending" ? "bg-ccb-accent/10 text-ccb-accent" :
                        d.status === "failed" ? "bg-ccb-danger/10 text-ccb-danger" :
                        "bg-ccb-surface text-ccb-muted"
                      }`}>{d.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BATTLES */}
          {tab === "battles" && (
            <div className="space-y-4">
              {battleConfig && (
                <div className="card space-y-4">
                  <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-ccb-primary" />
                    <h3 className="font-medium">Battle Configuration</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <ConfigInput
                      label="Stake (MWK cents)"
                      value={battleConfig.stake_cents}
                      onChange={(v) => setBattleConfig({ ...battleConfig, stake_cents: v })}
                    />
                    <ConfigInput
                      label="Platform Fee (%)"
                      value={battleConfig.platform_fee_pct}
                      onChange={(v) => setBattleConfig({ ...battleConfig, platform_fee_pct: v })}
                    />
                    <ConfigInput
                      label="Rating Range (+/-)"
                      value={battleConfig.rating_range}
                      onChange={(v) => setBattleConfig({ ...battleConfig, rating_range: v })}
                    />
                    <ConfigInput
                      label="Initial Minutes"
                      value={battleConfig.initial_minutes}
                      onChange={(v) => setBattleConfig({ ...battleConfig, initial_minutes: v })}
                    />
                    <ConfigInput
                      label="Increment (seconds)"
                      value={battleConfig.increment_seconds}
                      onChange={(v) => setBattleConfig({ ...battleConfig, increment_seconds: v })}
                    />
                    <ConfigInput
                      label="Armageddon Time (%)"
                      value={battleConfig.armageddon_pct}
                      onChange={(v) => setBattleConfig({ ...battleConfig, armageddon_pct: v })}
                    />
                    <ConfigInput
                      label="Max Armageddon Rounds"
                      value={battleConfig.max_armageddon_rounds}
                      onChange={(v) => setBattleConfig({ ...battleConfig, max_armageddon_rounds: v })}
                    />
                    <ConfigInput
                      label="Queue Timeout (seconds)"
                      value={battleConfig.queue_timeout_s}
                      onChange={(v) => setBattleConfig({ ...battleConfig, queue_timeout_s: v })}
                    />
                  </div>

                  <button
                    onClick={saveBattleConfig}
                    disabled={battleConfigSaving}
                    className="w-full py-2.5 rounded-lg bg-ccb-primary text-white text-sm font-medium hover:bg-ccb-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {battleConfigSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Battle Config
                  </button>
                </div>
              )}

              {battleStats?.totals && (
                <div className="card space-y-3">
                  <h3 className="font-medium text-sm text-ccb-muted uppercase tracking-wide">Battle Stats</h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold text-ccb-primary">{battleStats.totals.total || 0}</p>
                      <p className="text-xs text-ccb-muted">Total</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-ccb-success">{battleStats.totals.completed || 0}</p>
                      <p className="text-xs text-ccb-muted">Completed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-ccb-accent">{battleStats.totals.active || 0}</p>
                      <p className="text-xs text-ccb-muted">Active</p>
                    </div>
                  </div>
                </div>
              )}

              {battleStats?.recentBattles && battleStats.recentBattles.length > 0 && (
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
                          <span className={`text-xs px-2 py-1 rounded ${
                            b.status === "completed" ? "bg-ccb-success/10 text-ccb-success" :
                            b.status === "playing" || b.status === "draw_armageddon" ? "bg-ccb-accent/10 text-ccb-accent" :
                            b.status === "disputed" ? "bg-ccb-danger/10 text-ccb-danger" :
                            "bg-ccb-muted/10 text-ccb-muted"
                          }`}>{b.status}</span>
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

                <ConfigInput
                  label="Berries per Win"
                  value={berryConfig.berries_per_win ?? 10}
                  onChange={(v) => setBerryConfig({ ...berryConfig, berries_per_win: v })}
                />
                <ConfigInput
                  label="Berries per Draw"
                  value={berryConfig.berries_per_draw ?? 2}
                  onChange={(v) => setBerryConfig({ ...berryConfig, berries_per_draw: v })}
                />
                <ConfigInput
                  label="Berry Value (MWK cents per 100 berries)"
                  value={berryConfig.berry_value_cents ?? 1000}
                  onChange={(v) => setBerryConfig({ ...berryConfig, berry_value_cents: v })}
                />
                <p className="text-xs text-ccb-muted">100 berries = MWK {(berryConfig.berry_value_cents ?? 1000) / 100}</p>
                <ConfigInput
                  label="Minimum Redemption (berries)"
                  value={berryConfig.min_redemption ?? 1000}
                  onChange={(v) => setBerryConfig({ ...berryConfig, min_redemption: v })}
                />

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
                        showToast("Berry config saved");
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
                  {berrySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Berry Config
                </button>
              </div>
            </div>
          )}

          {/* ADMIN LOGS */}
          {tab === "logs" && (
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-ccb-muted text-sm">
                  <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No admin actions logged
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="card flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{log.action}</span>
                      <span className="text-ccb-muted ml-2">
                        by {log.profiles?.display_name || log.profiles?.username || "Admin"}
                      </span>
                    </div>
                    <div className="text-xs text-ccb-muted">
                      {log.target_type}:{log.target_id?.slice(0, 8)} · {formatDate(log.created_at)}
                    </div>
                  </div>
                ))
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

function ActionButton({ children, onClick, loading, variant }: { children: React.ReactNode; onClick: () => void; loading: boolean; variant: "primary" | "danger" | "success" | "default" }) {
  const colors = {
    primary: "bg-ccb-primary/10 text-ccb-primary hover:bg-ccb-primary/20",
    danger: "bg-ccb-danger/10 text-ccb-danger hover:bg-ccb-danger/20",
    success: "bg-ccb-success/10 text-ccb-success hover:bg-ccb-success/20",
    default: "bg-ccb-surface text-ccb-muted hover:text-ccb-text border border-ccb-border",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${colors[variant]}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : children}
    </button>
  );
}

function ConfigInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-ccb-muted mb-1 block">{label}</label>
      <input
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full px-3 py-2 rounded-lg bg-ccb-surface border border-ccb-border text-sm"
      />
    </div>
  );
}
