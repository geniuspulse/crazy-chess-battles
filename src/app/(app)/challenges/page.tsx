"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { detectOperator } from "@/lib/operator";
import {
  Swords, Clock, Zap, Link2, RefreshCw, Loader2, Users, Star, Coins, ChevronRight,
  Wallet, Smartphone, Check, AlertCircle, TrendingUp, X,
} from "lucide-react";

interface FreeChallenge {
  id: string;
  type: "free";
  time_control: string;
  initial_minutes: number;
  increment_seconds: number;
  rated: boolean;
  created_at: string;
  challenger: { username: string; display_name: string; rating: number };
}

interface BattleChallenge {
  id: string;
  type: "battle";
  stake_cents: number;
  created_at: string;
  challenger: { username: string; display_name: string; rating: number };
}

type Challenge = FreeChallenge | BattleChallenge;

const TC_ICONS: Record<string, any> = {
  bullet: Zap, blitz3: Zap, blitz: Zap, rapid: Clock, rapid15: Clock, classical: Clock,
};

const PLATFORM_FEE_PCT = 10; // matches DEFAULT_CONFIG

function formatMKK(cents: number): string {
  return `MK ${Math.floor(cents / 100).toLocaleString()}`;
}

function calcWinnings(stakeCents: number): number {
  const pot = stakeCents * 2;
  const fee = Math.round(pot * (PLATFORM_FEE_PCT / 100));
  return pot - fee;
}

// Quick deposit amounts that make sense for battle stakes
const QUICK_DEPOSIT_AMOUNTS = [500, 1000, 2500, 5000, 10000];

export default function ChallengesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // Inline deposit flow state
  const [depositChallengeId, setDepositChallengeId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState(1000);
  const [depositPhone, setDepositPhone] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositPolling, setDepositPolling] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const [pendingChargeId, setPendingChargeId] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance_cents, phone")
        .eq("id", user.id)
        .single();
      if (profile) {
        setBalance(profile.wallet_balance_cents ?? 0);
        if (profile.phone) setDepositPhone(profile.phone);
      }
    } catch {}
    setBalanceLoading(false);
  }, [supabase]);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const [freeRes, battleRes] = await Promise.all([
        supabase
          .from("challenges")
          .select("id, time_control, initial_minutes, increment_seconds, rated, created_at, challenger_id")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("battle_challenges")
          .select("id, stake_cents, created_at, challenger_id")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (freeRes.error) throw freeRes.error;
      if (battleRes.error) throw battleRes.error;

      const challengerIds = new Set<string>();
      (freeRes.data || []).forEach((c: any) => challengerIds.add(c.challenger_id));
      (battleRes.data || []).forEach((c: any) => challengerIds.add(c.challenger_id));

      if (challengerIds.size === 0) {
        setChallenges([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, rating")
        .in("id", Array.from(challengerIds));

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const freeChallenges: FreeChallenge[] = (freeRes.data || [])
        .filter((c: any) => c.challenger_id !== user?.id)
        .map((c: any) => ({
          id: c.id,
          type: "free" as const,
          time_control: c.time_control,
          initial_minutes: c.initial_minutes,
          increment_seconds: c.increment_seconds,
          rated: c.rated,
          created_at: c.created_at,
          challenger: {
            username: profileMap.get(c.challenger_id)?.username || "Unknown",
            display_name: profileMap.get(c.challenger_id)?.display_name || "Player",
            rating: profileMap.get(c.challenger_id)?.rating || 1200,
          },
        }));

      const battleChallenges: BattleChallenge[] = (battleRes.data || [])
        .filter((c: any) => c.challenger_id !== user?.id)
        .map((c: any) => ({
          id: c.id,
          type: "battle" as const,
          stake_cents: c.stake_cents,
          created_at: c.created_at,
          challenger: {
            username: profileMap.get(c.challenger_id)?.username || "Unknown",
            display_name: profileMap.get(c.challenger_id)?.display_name || "Player",
            rating: profileMap.get(c.challenger_id)?.rating || 1200,
          },
        }));

      const all = [...freeChallenges, ...battleChallenges].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setChallenges(all);
    } catch (e: any) {
      setError(e.message || "Failed to load challenges");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchChallenges();
    loadBalance();

    const channel = supabase
      .channel("all-challenges-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "challenges" }, () => fetchChallenges())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "challenges" }, () => fetchChallenges())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_challenges" }, () => fetchChallenges())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battle_challenges" }, () => fetchChallenges())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchChallenges, loadBalance, supabase]);

  const removeChallenge = (id: string) => {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  // Poll for deposit payment confirmation
  useEffect(() => {
    if (!pendingChargeId) return;
    setDepositPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chargeId: pendingChargeId }),
        });
        const data = await res.json();
        if (data.status === "success") {
          const amt = Math.floor(data.amount / 100).toLocaleString();
          setDepositSuccess(`MWK ${amt} added to your wallet!`);
          setDepositPolling(false);
          setPendingChargeId(null);
          clearInterval(interval);
          setBalance((prev) => prev + data.amount);
          // Auto-close deposit panel after a short delay
          setTimeout(() => {
            setDepositChallengeId(null);
            setDepositSuccess(null);
          }, 2000);
        } else if (data.status === "failed") {
          setDepositError("Payment failed or timed out. Please try again.");
          setDepositPolling(false);
          setPendingChargeId(null);
          clearInterval(interval);
        }
      } catch {}
    }, 5000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setDepositPolling(false);
      if (pendingChargeId) {
        setDepositError("Payment verification timed out. If you completed the payment, your balance will update shortly.");
        setPendingChargeId(null);
      }
    }, 180000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pendingChargeId]);

  const handleAcceptFree = async (challengeId: string) => {
    setAccepting(challengeId);
    setError(null);
    try {
      const res = await fetch("/api/challenge/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to accept challenge");
      removeChallenge(challengeId);
      if (data.gameId) router.push(`/game/${data.gameId}`);
    } catch (e: any) {
      setError(e.message || "Failed to accept");
      setAccepting(null);
    }
  };

  const handleAcceptBattle = async (challengeId: string, stakeCents: number) => {
    // Check balance client-side first for a snappy UX
    if (balance < stakeCents) {
      setDepositChallengeId(challengeId);
      // Pre-fill the deposit amount to cover the stake (rounded to nearest quick option)
      const needed = Math.ceil(stakeCents / 100);
      const quickMatch = QUICK_DEPOSIT_AMOUNTS.find((a) => a >= needed);
      setDepositAmount(quickMatch || needed);
      return;
    }

    setAccepting(challengeId);
    setError(null);
    try {
      const res = await fetch("/api/battles/challenge/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });
      const data = await res.json();

      // Server says insufficient funds (balance changed server-side)
      if (res.status === 402 && data.insufficientFunds) {
        setAccepting(null);
        setDepositChallengeId(challengeId);
        setBalance(data.balanceCents ?? balance);
        const needed = Math.ceil((data.requiredCents ?? stakeCents) / 100);
        const quickMatch = QUICK_DEPOSIT_AMOUNTS.find((a) => a >= needed);
        setDepositAmount(quickMatch || needed);
        return;
      }

      if (!res.ok || data.error) throw new Error(data.error || "Failed to accept battle");
      removeChallenge(challengeId);

      const startRes = await fetch("/api/battles/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId: data.battleId }),
      });
      const startData = await startRes.json();
      if (startRes.ok && startData.gameId) {
        router.push(`/game/${startData.gameId}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 1200));
      const retryRes = await fetch("/api/battles/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId: data.battleId }),
      });
      const retryData = await retryRes.json();
      if (retryRes.ok && retryData.gameId) {
        router.push(`/game/${retryData.gameId}`);
      } else {
        router.push("/battles");
      }
    } catch (e: any) {
      setError(e.message || "Failed to accept");
      setAccepting(null);
    }
  };

  const handleDeposit = async () => {
    setDepositLoading(true);
    setDepositError(null);
    setDepositSuccess(null);

    if (!depositPhone || depositPhone.length < 9) {
      setDepositError("Enter a valid phone number (e.g., 0991234567)");
      setDepositLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/payments/deposit/mobile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: depositAmount * 100,
          phone: depositPhone,
          operatorRefId: detectOperator(depositPhone),
          email: userEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Payment failed. Please try again.");
      }
      setPendingChargeId(data.chargeId);
      setDepositSuccess("Check your phone to authorize the payment. Waiting for confirmation...");
    } catch (err: any) {
      setDepositError(err.message && err.message.length < 200 ? err.message : "Something went wrong. Please try again.");
    } finally {
      setDepositLoading(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 1900) return "text-cyan-400";
    if (rating >= 1600) return "text-emerald-400";
    if (rating >= 1300) return "text-ccb-accent";
    if (rating >= 1000) return "text-ccb-silver";
    return "text-ccb-muted";
  };

  const freeCount = challenges.filter((c) => c.type === "free").length;
  const battleCount = challenges.filter((c) => c.type === "battle").length;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-20 sm:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-ccb-primary" /> Open Challenges
          </h1>
          <p className="text-sm text-ccb-muted mt-1">
            {freeCount} free · {battleCount} battle
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Wallet balance pill */}
          {!balanceLoading && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ccb-surface border border-ccb-border text-sm">
              <Wallet className="w-4 h-4 text-ccb-primary" />
              <span className="font-semibold">{formatMKK(balance)}</span>
            </div>
          )}
          <button onClick={fetchChallenges} className="btn-secondary px-3 py-2" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile balance pill */}
      {!balanceLoading && (
        <div className="sm:hidden flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-ccb-surface border border-ccb-border text-sm">
          <Wallet className="w-4 h-4 text-ccb-primary" />
          <span className="font-semibold">{formatMKK(balance)}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {loading && challenges.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-ccb-primary animate-spin" />
          <p className="text-sm text-ccb-muted mt-3">Loading challenges...</p>
        </div>
      )}

      {!loading && challenges.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-ccb-primary/10 flex items-center justify-center mb-4">
            <Swords className="w-8 h-8 text-ccb-muted" />
          </div>
          <h2 className="text-lg font-bold mb-1">No open challenges</h2>
          <p className="text-sm text-ccb-muted max-w-xs">
            Nobody has an open challenge right now. Create one and share it with a friend!
          </p>
          <button onClick={() => router.push("/play")} className="btn-primary mt-4 px-6">
            <Link2 className="w-4 h-4 mr-1.5" /> Create a Challenge
          </button>
        </div>
      )}

      {challenges.length > 0 && (
        <div className="grid gap-3">
          {challenges.map((c) => {
            const isBattle = c.type === "battle";
            const acceptingThis = accepting === c.id;
            const winnings = isBattle ? calcWinnings((c as BattleChallenge).stake_cents) : 0;
            const stake = isBattle ? (c as BattleChallenge).stake_cents : 0;
            const canAfford = !isBattle || balance >= stake;
            const showDepositPanel = isBattle && depositChallengeId === c.id;

            return (
              <div
                key={c.id}
                className="group rounded-xl border border-ccb-border bg-ccb-card p-4 transition-all hover:border-ccb-primary/40 hover:shadow-lg hover:shadow-ccb-primary/5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center shrink-0 ${
                      isBattle ? "bg-ccb-primary/10 border-ccb-primary/30" : "bg-ccb-surface border-ccb-border"
                    }`}>
                      <span className={`text-sm font-bold ${isBattle ? "text-ccb-primary" : "text-ccb-primary"}`}>
                        {c.challenger.display_name?.[0]?.toUpperCase() || c.challenger.username?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{c.challenger.display_name || c.challenger.username}</span>
                        <span className={`text-xs font-bold shrink-0 ${getRatingColor(c.challenger.rating)}`}>
                          {c.challenger.rating}
                        </span>
                        {isBattle ? (
                          <span className="badge bg-ccb-primary/15 text-ccb-primary text-[10px] px-1.5 py-0.5 flex items-center gap-0.5">
                            <Coins className="w-2.5 h-2.5" />Battle
                          </span>
                        ) : c.rated ? (
                          <span className="badge bg-ccb-accent/15 text-ccb-accent text-[10px] px-1.5 py-0.5 flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5" />Ranked
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-ccb-muted flex-wrap">
                        {isBattle ? (
                          <>
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Coins className="w-3.5 h-3.5 shrink-0" />Stake: {formatMKK(stake)}
                            </span>
                            <span className="text-ccb-border">•</span>
                            <span className="flex items-center gap-1 whitespace-nowrap text-ccb-success font-semibold">
                              <TrendingUp className="w-3.5 h-3.5 shrink-0" />Win: {formatMKK(winnings)}
                            </span>
                            <span className="text-ccb-border">•</span>
                            <span className="whitespace-nowrap">{formatTimeAgo(c.created_at)}</span>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              {(() => {
                                const Icon = TC_ICONS[c.time_control] || Clock;
                                return <Icon className="w-3.5 h-3.5 shrink-0" />;
                              })()}
                              {c.initial_minutes}+{c.increment_seconds}
                            </span>
                            <span className="text-ccb-border">•</span>
                            <span className="whitespace-nowrap">{formatTimeAgo(c.created_at)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Accept button */}
                  <button
                    onClick={() => isBattle ? handleAcceptBattle(c.id, stake) : handleAcceptFree(c.id)}
                    disabled={acceptingThis}
                    className={`btn-primary w-full sm:w-auto px-5 py-2.5 shrink-0`}
                  >
                    {acceptingThis ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : !canAfford ? (
                      <><Wallet className="w-4 h-4 mr-1.5" /> Deposit & Play</>
                    ) : (
                      <><Swords className="w-4 h-4 mr-1.5" /> Accept</>
                    )}
                  </button>
                </div>

                {/* Insufficient funds warning bar */}
                {isBattle && !canAfford && !showDepositPanel && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      You need {formatMKK(stake)} to accept. Your balance: {formatMKK(balance)}.
                    </span>
                    <button
                      onClick={() => {
                        setDepositChallengeId(c.id);
                        const needed = Math.ceil(stake / 100);
                        const quickMatch = QUICK_DEPOSIT_AMOUNTS.find((a) => a >= needed);
                        setDepositAmount(quickMatch || needed);
                      }}
                      className="ml-auto font-semibold underline hover:text-amber-300 whitespace-nowrap"
                    >
                      Deposit now
                    </button>
                  </div>
                )}

                {/* Inline deposit panel */}
                {showDepositPanel && (
                  <div className="mt-3 p-4 rounded-lg bg-ccb-surface border border-ccb-primary/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-ccb-primary" /> Deposit via Mobile Money
                      </h4>
                      <button
                        onClick={() => { setDepositChallengeId(null); setDepositError(null); setDepositSuccess(null); }}
                        className="text-ccb-muted hover:text-ccb-text p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-ccb-muted">
                      You need {formatMKK(stake)} to accept this battle. Deposit to your wallet and the battle is yours.
                    </p>

                    {/* Quick amounts */}
                    <div className="flex flex-wrap gap-2">
                      {QUICK_DEPOSIT_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setDepositAmount(amt)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            depositAmount === amt
                              ? "bg-ccb-primary text-white"
                              : "bg-ccb-card border border-ccb-border text-ccb-muted hover:text-ccb-text"
                          }`}
                        >
                          MK {amt.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    {/* Phone input */}
                    <div>
                      <label className="text-xs text-ccb-muted mb-1 block">Phone Number</label>
                      <input
                        type="tel"
                        value={depositPhone}
                        onChange={(e) => setDepositPhone(e.target.value)}
                        placeholder="0991234567"
                        className="input-field w-full"
                        disabled={depositPolling}
                      />
                    </div>

                    {/* Deposit summary */}
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-ccb-card text-sm">
                      <span className="text-ccb-muted">You deposit</span>
                      <span className="font-semibold">{formatMKK(depositAmount * 100)}</span>
                    </div>

                    {depositError && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {depositError}
                      </div>
                    )}

                    {depositSuccess && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ccb-success/10 border border-ccb-success/30 text-ccb-success text-xs">
                        <Check className="w-4 h-4 shrink-0" />
                        {depositSuccess}
                      </div>
                    )}

                    <button
                      onClick={handleDeposit}
                      disabled={depositLoading || depositPolling}
                      className="btn-primary w-full py-2.5"
                    >
                      {depositLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : depositPolling ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Waiting for confirmation...</>
                      ) : (
                        <><Smartphone className="w-4 h-4 mr-1.5" /> Deposit {formatMKK(depositAmount * 100)}</>
                      )}
                    </button>

                    <p className="text-[10px] text-ccb-muted text-center">
                      You'll receive a mobile money prompt on your phone to authorize the payment.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div className="text-center pt-2">
          <button onClick={() => router.push("/play")} className="text-sm text-ccb-primary hover:underline">
            ← Back to Play
          </button>
        </div>
      )}
    </div>
  );
}
