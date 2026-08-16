"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, ArrowDownUp, Trophy, Loader2, Check, X,
  TrendingUp, Wallet, AlertCircle, ChevronRight
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

type Tab = "overview" | "withdrawals" | "users";

export default function AdminDashboard({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState("pending");

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchStats();
      if (tab === "withdrawals") await fetchWithdrawals();
      if (tab === "users") await fetchUsers();
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
