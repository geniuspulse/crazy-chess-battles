"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Swords, Clock, Coins, Zap, AlertCircle, Loader2, Link2, Copy, Check,
  RefreshCw, XCircle, ChevronRight, Users, Target, Sparkles, Bot,
} from "lucide-react";

const DEFAULT_STAKES = [50000, 100000, 250000, 500000, 1000000];

const TIME_CONTROLS = [
  { id: "bullet",    label: "Bullet",    desc: "1+0",   icon: Zap },
  { id: "blitz3",    label: "Blitz",     desc: "3+2",   icon: Zap },
  { id: "blitz",     label: "Blitz",     desc: "5+0",   icon: Zap },
  { id: "rapid",     label: "Rapid",     desc: "10+0",  icon: Clock },
  { id: "rapid15",   label: "Rapid",     desc: "15+10", icon: Clock },
  { id: "classical", label: "Classical", desc: "30+0",  icon: Clock },
];

function formatMKK(cents: number): string {
  return `MK ${Math.floor(cents / 100).toLocaleString("en-US")}`;
}

interface BattleConfig {
  enabled: boolean;
  stake_levels: number[];
  platform_fee_pct: number;
  rating_range: number;
  initial_minutes: number;
  increment_seconds: number;
}

type Mode = "menu" | "quickbattle" | "challenge" | "browse";
type BattleState = "select" | "searching" | "matched" | "playing";

export default function BattlesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("menu");
  const [config, setConfig] = useState<BattleConfig | null>(null);
  const [balance, setBalance] = useState(0);
  const [selectedStake, setSelectedStake] = useState<number | null>(null);
  const [selectedTC, setSelectedTC] = useState("blitz");
  const [state, setState] = useState<BattleState>("select");
  const [battleId, setBattleId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<{ username: string; display_name: string; rating: number } | null>(null);
  const [myRating, setMyRating] = useState(1200);
  const [error, setError] = useState<string | null>(null);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [adminNotified, setAdminNotified] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);
  const [activeBattle, setActiveBattle] = useState<{
    battleId: string;
    gameId?: string;
    status: string;
    stuck?: boolean;
    stakeCents?: number;
  } | null>(null);
  const [cancellingStuck, setCancellingStuck] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminNotifyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkActiveBattle = useCallback(async () => {
    try {
      const res = await fetch("/api/battles/active");
      if (!res.ok) { setCheckingActive(false); return; }
      const data = await res.json();
      if (data.active) {
        setActiveBattle(data);
        if (data.gameId && data.status === "playing") {
          router.push(`/game/${data.gameId}`);
          return;
        }
      } else {
        setActiveBattle(null);
      }
    } catch {}
    setCheckingActive(false);
  }, [router]);

  useEffect(() => {
    loadConfig();
    loadProfile();
    checkActiveBattle();
  }, [checkActiveBattle]);

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/battles/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {}
  };

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("rating, wallet_balance_cents")
      .eq("id", user.id)
      .single();
    if (profile) {
      setMyRating(profile.rating ?? 1200);
      setBalance(profile.wallet_balance_cents ?? 0);
    }
  };

  const handleCancelStuck = async () => {
    if (!activeBattle) return;
    setCancellingStuck(true);
    setError(null);
    try {
      const res = await fetch("/api/battles/cancel-stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId: activeBattle.battleId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to cancel"); setCancellingStuck(false); return; }
      setActiveBattle(null);
      loadProfile();
    } catch { setError("Failed to cancel"); }
    setCancellingStuck(false);
  };

  // Poll for match while searching
  useEffect(() => {
    if (state !== "searching") return;

    searchIntervalRef.current = setInterval(() => {
      setSearchSeconds((s) => s + 1);
    }, 1000);

    pollRef.current = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: queueEntry } = await supabase
        .from("battle_queue")
        .select("status, battle_id")
        .eq("player_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (queueEntry?.status === "matched" && queueEntry.battle_id) {
        const res = await fetch(`/api/battles/status?battleId=${queueEntry.battle_id}`);
        if (res.ok) {
          const battleData = await res.json();
          setBattleId(queueEntry.battle_id);
          setOpponent(battleData.opponent);
          setState("matched");
        }
      }
    }, 2000);

    // After 20 seconds, notify admin that a player is waiting
    adminNotifyRef.current = setTimeout(async () => {
      try {
        await fetch("/api/notify-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeControl: selectedTC,
            rated: true,
            context: "battle",
            stake: selectedStake,
          }),
        });
        setAdminNotified(true);
      } catch {}
    }, 20000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
      if (adminNotifyRef.current) clearTimeout(adminNotifyRef.current);
    };
  }, [state, selectedTC, selectedStake, supabase]);

  const handleEnterBattle = async () => {
    if (selectedStake === null) return;
    setError(null);

    if (balance < selectedStake) {
      setError(`Insufficient balance. You need ${formatMKK(selectedStake)}. Deposit funds first.`);
      return;
    }

    try {
      const res = await fetch("/api/battles/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stakeCents: selectedStake, timeControl: selectedTC }),
      });

      const data = await res.json();

      if (!res.ok) { setError(data.error || "Failed to join battle"); return; }

      if (data.matched && data.battleId) {
        setBattleId(data.battleId);
        const statusRes = await fetch(`/api/battles/status?battleId=${data.battleId}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setOpponent(statusData.opponent);
          setState("matched");
        }
      } else {
        setState("searching");
        setSearchSeconds(0);
        setAdminNotified(false);
      }
    } catch { setError("Failed to join battle queue"); }
  };

  const handleChallengeFriend = async () => {
    if (selectedStake === null) return;
    setError(null);
    setChallengeUrl(null);

    if (balance < selectedStake) {
      setError(`Insufficient balance. You need ${formatMKK(selectedStake)}. Deposit funds first.`);
      return;
    }

    setCreatingChallenge(true);
    try {
      const res = await fetch("/api/battles/challenge/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stakeCents: selectedStake, timeControl: selectedTC }),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error || "Failed to create challenge"); setCreatingChallenge(false); return; }

      // Stake is now locked — go to the waiting screen
      router.push(`/battle-challenge/${data.challengeId}`);
    } catch { setError("Failed to create challenge"); }
    setCreatingChallenge(false);
  };

  const handleLeaveQueue = async () => {
    await fetch("/api/battles/leave", { method: "POST" });
    setState("select");
    setSearchSeconds(0);
    setAdminNotified(false);
    loadProfile();
  };

  const handlePlayBattle = async () => {
    if (!battleId) return;
    try {
      const res = await fetch("/api/battles/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId, timeControl: selectedTC }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to start game"); return; }
      router.push(`/game/${data.gameId}`);
    } catch { setError("Failed to start battle game"); }
  };

  const stakes = config?.stake_levels ?? DEFAULT_STAKES;
  const feePct = config?.platform_fee_pct ?? 10;

  // Disabled state
  if (!config?.enabled && config !== null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertCircle className="w-12 h-12 text-ccb-muted mb-4" />
        <p className="text-lg font-semibold">Chess Battles are currently disabled</p>
        <p className="text-sm text-ccb-muted mt-2">Check back later or contact an admin.</p>
      </div>
    );
  }

  // Active battle blocking
  if (checkingActive) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-ccb-primary animate-spin mb-3" />
        <p className="text-sm text-ccb-muted">Checking for active battles...</p>
      </div>
    );
  }

  if (activeBattle) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 sm:py-10 sm:pb-10">
        <div className="text-center py-8">
          <Swords className="w-10 h-10 text-ccb-primary mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-1">You have an active battle</h2>
          <p className="text-sm text-ccb-muted mb-6">
            {activeBattle.stuck ? "It failed to start and got stuck — you can cancel it for a full refund." : "Finish it before starting a new one."}
          </p>
          <div className="flex flex-col items-center gap-3">
            {activeBattle.gameId ? (
              <button onClick={() => router.push(`/game/${activeBattle.gameId}`)} className="btn-primary px-8 py-3.5">
                <Swords className="w-4 h-4 mr-1.5" /> Resume Game
              </button>
            ) : activeBattle.stuck ? (
              <>
                <button onClick={checkActiveBattle} className="btn-secondary px-8 py-3.5">
                  <RefreshCw className="w-4 h-4 mr-1.5" /> Try Again
                </button>
                <button onClick={handleCancelStuck} disabled={cancellingStuck} className="px-8 py-3.5 rounded-xl font-semibold text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  {cancellingStuck ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1.5" />}
                  {cancellingStuck ? "Cancelling..." : "Cancel & Refund"}
                </button>
              </>
            ) : (
              <button onClick={checkActiveBattle} className="btn-secondary px-8 py-3.5">
                <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== Searching state =====
  if (state === "searching") {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[70vh] space-y-6 animate-slide-up px-4">
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-ccb-primary/10 flex items-center justify-center animate-pulse-glow">
            <Coins className="w-14 h-14 text-ccb-primary" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-ccb-primary/20 border-t-ccb-primary animate-spin" style={{ animationDuration: "1.5s" }} />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold mb-1">{formatMKK(selectedStake!)} Battle</h2>
          <p className="text-sm text-ccb-muted">
            {TIME_CONTROLS.find((t) => t.id === selectedTC)?.desc} · Searching for opponent...
          </p>
          <p className="text-xs text-ccb-muted mt-2 tabular-nums">{searchSeconds}s elapsed</p>
        </div>

        {adminNotified && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-ccb-primary/10 border border-ccb-primary/30 text-xs text-ccb-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Admin notified — they may join to play you!</span>
          </div>
        )}

        <div className="w-full max-w-xs p-4 rounded-xl bg-ccb-card border border-ccb-border">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-ccb-muted">Your stake locked</span>
            <span className="font-semibold">{formatMKK(selectedStake!)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ccb-muted">Win potential</span>
            <span className="font-bold text-ccb-primary">
              {formatMKK(selectedStake! * 2 - Math.round(selectedStake! * 2 * (feePct / 100)))}
            </span>
          </div>
        </div>

        <button onClick={handleLeaveQueue} className="btn-secondary px-8">
          <XCircle className="w-4 h-4 mr-1.5" /> Cancel & Refund
        </button>
      </div>
    );
  }

  // ===== Matched state =====
  if (state === "matched" && opponent) {
    return (
      <div className="max-w-2xl mx-auto text-center py-8 animate-slide-up">
        <div className="mb-2 inline-block">
          <span className="px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium">
            OPPONENT FOUND
          </span>
        </div>

        <div className="flex items-center justify-center gap-6 sm:gap-12 my-8">
          <div className="text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-ccb-surface border-2 border-ccb-border flex items-center justify-center mx-auto mb-2">
              <span className="text-xl font-bold">
                {(opponent.display_name || opponent.username || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="font-semibold text-sm sm:text-base">{opponent.display_name || opponent.username}</p>
            <p className="text-ccb-muted text-xs sm:text-sm">{opponent.rating} Rating</p>
          </div>

          <div className="text-center">
            <span className="text-2xl font-bold text-ccb-muted">VS</span>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-ccb-primary/10 border-2 border-ccb-primary flex items-center justify-center mx-auto mb-2">
              <span className="text-xl font-bold text-ccb-primary">You</span>
            </div>
            <p className="font-semibold text-sm sm:text-base">You</p>
            <p className="text-ccb-muted text-xs sm:text-sm">{myRating} Rating</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-ccb-card border border-ccb-border max-w-xs mx-auto">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-ccb-muted">Stake</span>
            <span className="font-semibold">{formatMKK(selectedStake!)} each</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ccb-muted">Winner receives</span>
            <span className="font-bold text-ccb-primary">
              {formatMKK(selectedStake! * 2 - Math.round(selectedStake! * 2 * (feePct / 100)))}
            </span>
          </div>
        </div>

        <button onClick={handlePlayBattle} className="btn-primary mt-8 px-10 py-4 text-lg">
          <Swords className="w-5 h-5 mr-2" /> PLAY BATTLE
        </button>
      </div>
    );
  }

  // ===== Mode: Quick Battle (stake + time + search) =====
  if (mode === "quickbattle") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20 sm:pb-0 animate-slide-up">
        <button onClick={() => setMode("menu")} className="text-sm text-ccb-muted hover:text-ccb-text flex items-center gap-1">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back
        </button>

        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-ccb-primary/15 flex items-center justify-center">
              <Coins className="w-5 h-5 text-ccb-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Quick Battle</h1>
              <p className="text-sm text-ccb-muted">Auto-matched by stake and rating</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Time Control */}
        <div>
          <h3 className="text-sm font-medium text-ccb-muted mb-3">Time Control</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TIME_CONTROLS.map((tc) => {
              const Icon = tc.icon;
              const isSelected = selectedTC === tc.id;
              return (
                <button key={tc.id} onClick={() => setSelectedTC(tc.id)}
                  className={`tc-btn flex items-center gap-3 text-left ${isSelected ? "tc-active" : ""}`}>
                  <Icon className={`w-5 h-5 ${isSelected ? "text-ccb-primary" : "text-ccb-muted"}`} />
                  <div>
                    <div className="text-sm font-medium">{tc.desc}</div>
                    <div className="text-xs text-ccb-muted">{tc.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stake selection */}
        <div>
          <h3 className="text-sm font-medium text-ccb-muted mb-3">Choose Your Stake</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stakes.map((stake) => {
              const isSelected = selectedStake === stake;
              const canAfford = balance >= stake;
              const payout = stake * 2 - Math.round(stake * 2 * (feePct / 100));
              return (
                <button key={stake} onClick={() => canAfford && setSelectedStake(stake)} disabled={!canAfford}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    isSelected ? "border-ccb-primary bg-ccb-primary/10"
                      : canAfford ? "border-ccb-border bg-ccb-surface hover:border-ccb-primary/50"
                      : "border-ccb-border bg-ccb-surface/50 opacity-50 cursor-not-allowed"
                  }`}>
                  <Coins className={`w-5 h-5 mx-auto mb-2 ${isSelected ? "text-ccb-primary" : "text-ccb-muted"}`} />
                  <p className={`font-bold text-lg ${isSelected ? "text-ccb-primary" : ""}`}>{formatMKK(stake)}</p>
                  <p className="text-xs text-ccb-muted mt-1">Win {formatMKK(payout)}</p>
                  {!canAfford && <p className="text-xs text-red-400 mt-1">Insufficient</p>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        {selectedStake !== null && (
          <div className="p-4 rounded-xl bg-ccb-card border border-ccb-border">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ccb-muted">Your stake</span>
              <span className="font-semibold">{formatMKK(selectedStake)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ccb-muted">Time control</span>
              <span className="font-semibold">{TIME_CONTROLS.find((t) => t.id === selectedTC)?.desc}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ccb-muted">Total pot</span>
              <span className="font-semibold">{formatMKK(selectedStake * 2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ccb-muted">Platform fee ({feePct}%)</span>
              <span className="font-semibold text-red-400">−{formatMKK(Math.round(selectedStake * 2 * (feePct / 100)))}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-ccb-border">
              <span className="text-ccb-muted">Winner receives</span>
              <span className="font-bold text-ccb-primary text-lg">
                {formatMKK(selectedStake * 2 - Math.round(selectedStake * 2 * (feePct / 100)))}
              </span>
            </div>
          </div>
        )}

        <button onClick={handleEnterBattle} disabled={selectedStake === null}
          className="btn-primary w-full text-base py-3.5">
          <Swords className="w-5 h-5 mr-2" /> Enter Battle
        </button>

        <p className="text-xs text-ccb-muted text-center">
          If no opponent is found, the admin will be notified after 20s. You can cancel anytime for a full refund.
        </p>
      </div>
    );
  }

  // ===== Mode: Challenge a Friend =====
  if (mode === "challenge") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20 sm:pb-0 animate-slide-up">
        <button onClick={() => setMode("menu")} className="text-sm text-ccb-muted hover:text-ccb-text flex items-center gap-1">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back
        </button>

        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-ccb-accent/15 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-ccb-accent" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Challenge a Friend</h1>
              <p className="text-sm text-ccb-muted">Set the stakes, share the link, winner takes the pot</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Time Control */}
        <div>
          <h3 className="text-sm font-medium text-ccb-muted mb-3">Time Control</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TIME_CONTROLS.map((tc) => {
              const Icon = tc.icon;
              const isSelected = selectedTC === tc.id;
              return (
                <button key={tc.id} onClick={() => setSelectedTC(tc.id)}
                  className={`tc-btn flex items-center gap-3 text-left ${isSelected ? "tc-active" : ""}`}>
                  <Icon className={`w-5 h-5 ${isSelected ? "text-ccb-primary" : "text-ccb-muted"}`} />
                  <div>
                    <div className="text-sm font-medium">{tc.desc}</div>
                    <div className="text-xs text-ccb-muted">{tc.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stake */}
        <div>
          <h3 className="text-sm font-medium text-ccb-muted mb-3">Choose Your Stake</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stakes.map((stake) => {
              const isSelected = selectedStake === stake;
              const canAfford = balance >= stake;
              const payout = stake * 2 - Math.round(stake * 2 * (feePct / 100));
              return (
                <button key={stake} onClick={() => canAfford && setSelectedStake(stake)} disabled={!canAfford}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    isSelected ? "border-ccb-accent bg-ccb-accent/10"
                      : canAfford ? "border-ccb-border bg-ccb-surface hover:border-ccb-accent/50"
                      : "border-ccb-border bg-ccb-surface/50 opacity-50 cursor-not-allowed"
                  }`}>
                  <Coins className={`w-5 h-5 mx-auto mb-2 ${isSelected ? "text-ccb-accent" : "text-ccb-muted"}`} />
                  <p className={`font-bold text-lg ${isSelected ? "text-ccb-accent" : ""}`}>{formatMKK(stake)}</p>
                  <p className="text-xs text-ccb-muted mt-1">Win {formatMKK(payout)}</p>
                  {!canAfford && <p className="text-xs text-red-400 mt-1">Insufficient</p>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        {selectedStake !== null && (
          <div className="p-4 rounded-xl bg-ccb-card border border-ccb-border">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ccb-muted">Your stake</span>
              <span className="font-semibold">{formatMKK(selectedStake)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ccb-muted">Time control</span>
              <span className="font-semibold">{TIME_CONTROLS.find((t) => t.id === selectedTC)?.desc}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-ccb-border">
              <span className="text-ccb-muted">Winner receives</span>
              <span className="font-bold text-ccb-accent text-lg">
                {formatMKK(selectedStake * 2 - Math.round(selectedStake * 2 * (feePct / 100)))}
              </span>
            </div>
          </div>
        )}

        <button onClick={handleChallengeFriend} disabled={selectedStake === null || creatingChallenge}
          className="btn-primary w-full text-base py-3.5">
          {creatingChallenge ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5 mr-2" />}
          {creatingChallenge ? "Creating..." : "Create Challenge Link"}
        </button>

        <div className="text-center">
          <button onClick={() => setMode("browse")} className="text-sm text-ccb-primary hover:underline">
            Browse open battle challenges →
          </button>
        </div>
      </div>
    );
  }

  // ===== Mode: Browse Battle Challenges =====
  if (mode === "browse") {
    return <BrowseBattleChallenges onBack={() => setMode("menu")} router={router} supabase={supabase} myRating={myRating} balance={balance} feePct={feePct} />;
  }

  // ===== Main mode menu =====
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 sm:py-10 sm:pb-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-2">
          <Swords className="w-7 h-7 text-ccb-primary" />
          <h1 className="text-2xl font-bold">Chess Battles</h1>
        </div>
        <p className="text-sm text-ccb-muted">Stake your coins. Beat your opponent. Win the pot.</p>
        <div className="mt-3 flex items-center justify-center gap-4 text-sm">
          <span className="text-ccb-muted">Balance: <span className="font-semibold text-ccb-text">{formatMKK(balance)}</span></span>
          <span className="text-ccb-muted">Rating: <span className="font-semibold text-ccb-text">{myRating}</span></span>
        </div>
      </div>

      {/* Mode cards */}
      <div className="grid gap-4">
        {/* Quick Battle */}
        <button onClick={() => { setMode("quickbattle"); setState("select"); setError(null); }}
          className="group relative overflow-hidden rounded-2xl border border-ccb-border bg-ccb-card p-6 text-left transition-all hover:border-ccb-primary/50 hover:shadow-xl hover:shadow-ccb-primary/5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-ccb-primary to-ccb-primaryHover flex items-center justify-center shrink-0">
              <Coins className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold flex items-center gap-2">
                Quick Battle
                <span className="badge bg-ccb-primary/15 text-ccb-primary text-[10px] px-2 py-0.5">AUTO</span>
              </h2>
              <p className="text-sm text-ccb-muted mt-0.5">
                Pick your stake and time control. Get matched instantly with a player of similar rating.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-ccb-muted group-hover:text-ccb-primary transition-colors shrink-0" />
          </div>
        </button>

        {/* Challenge a Friend */}
        <button onClick={() => { setMode("challenge"); setError(null); }}
          className="group relative overflow-hidden rounded-2xl border border-ccb-border bg-ccb-card p-6 text-left transition-all hover:border-ccb-accent/50 hover:shadow-xl hover:shadow-ccb-accent/5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-ccb-accent to-amber-600 flex items-center justify-center shrink-0">
              <Link2 className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold flex items-center gap-2">
                Challenge a Friend
                <span className="badge bg-ccb-accent/15 text-ccb-accent text-[10px] px-2 py-0.5">SHARE</span>
              </h2>
              <p className="text-sm text-ccb-muted mt-0.5">
                Set up a staked game with your rules and share a link. Your stake is locked in escrow.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-ccb-muted group-hover:text-ccb-accent transition-colors shrink-0" />
          </div>
        </button>

        {/* Browse Challenges */}
        <button onClick={() => setMode("browse")}
          className="group relative overflow-hidden rounded-2xl border border-ccb-border bg-ccb-card p-6 text-left transition-all hover:border-ccb-success/50 hover:shadow-xl hover:shadow-ccb-success/5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-ccb-success to-emerald-700 flex items-center justify-center shrink-0">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold flex items-center gap-2">
                Browse Challenges
                <span className="badge bg-ccb-success/15 text-ccb-success text-[10px] px-2 py-0.5">OPEN</span>
              </h2>
              <p className="text-sm text-ccb-muted mt-0.5">
                See open battle challenges from other players. Accept one and start playing immediately.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-ccb-muted group-hover:text-ccb-success transition-colors shrink-0" />
          </div>
        </button>
      </div>

      {/* How it works */}
      <div className="mt-8 p-4 rounded-xl bg-ccb-surface border border-ccb-border">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-ccb-primary" /> How it works
        </h3>
        <div className="space-y-2 text-sm text-ccb-muted">
          <p>1. Pick your stake — both players lock funds in escrow</p>
          <p>2. Choose your time control (Bullet to Classical)</p>
          <p>3. Win the game, take the pot (minus {feePct}% platform fee)</p>
          <p>4. Draw triggers Armageddon tiebreak — winner of that takes the pot</p>
        </div>
      </div>
    </div>
  );
}

// ===== Browse Battle Challenges component =====
function BrowseBattleChallenges({
  onBack, router, supabase, myRating, balance, feePct,
}: {
  onBack: () => void;
  router: ReturnType<typeof useRouter>;
  supabase: ReturnType<typeof createClient>;
  myRating: number;
  balance: number;
  feePct: number;
}) {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data, error: fetchErr } = await supabase
        .from("battle_challenges")
        .select("id, stake_cents, created_at, challenger_id")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(30);

      if (fetchErr) throw fetchErr;
      if (!data || data.length === 0) { setChallenges([]); setLoading(false); return; }

      const challengerIds = [...new Set(data.map((c: any) => c.challenger_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, rating")
        .in("id", challengerIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const enriched = data
        .filter((c: any) => c.challenger_id !== user?.id)
        .map((c: any) => ({
          id: c.id,
          stake_cents: c.stake_cents,
          created_at: c.created_at,
          challenger: {
            username: profileMap.get(c.challenger_id)?.username || "Unknown",
            display_name: profileMap.get(c.challenger_id)?.display_name || "Player",
            rating: profileMap.get(c.challenger_id)?.rating || 1200,
          },
        }));

      setChallenges(enriched);
    } catch (e: any) { setError(e.message || "Failed to load challenges"); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchChallenges();
    const channel = supabase
      .channel("battle-challenges-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_challenges" }, () => fetchChallenges())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battle_challenges" }, () => fetchChallenges())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchChallenges, supabase]);

  const handleAccept = async (challengeId: string, stakeCents: number) => {
    if (balance < stakeCents) {
      setError(`Insufficient balance. You need ${formatMKK(stakeCents)}. Deposit first.`);
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
      if (!res.ok || data.error) throw new Error(data.error || "Failed to accept");

      // Start the battle game
      const startRes = await fetch("/api/battles/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId: data.battleId }),
      });
      const startData = await startRes.json();
      if (!startRes.ok || !startData.gameId) {
        // Retry once
        await new Promise((r) => setTimeout(r, 1200));
        const retryRes = await fetch("/api/battles/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ battleId: data.battleId }),
        });
        const retryData = await retryRes.json();
        if (!retryRes.ok || !retryData.gameId) throw new Error("Battle accepted but game failed to start. Try again from your active battles.");
        router.push(`/game/${retryData.gameId}`);
        return;
      }
      router.push(`/game/${startData.gameId}`);
    } catch (e: any) { setError(e.message); setAccepting(null); }
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

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-20 sm:pb-0 animate-slide-up">
      <button onClick={onBack} className="text-sm text-ccb-muted hover:text-ccb-text flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" /> Back
      </button>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-ccb-success" /> Open Battle Challenges
        </h1>
        <p className="text-sm text-ccb-muted mt-1">Accept a challenge and play for the pot</p>
      </div>

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
          <p className="text-sm text-ccb-muted max-w-xs">Nobody has an open battle challenge right now. Create one and share it!</p>
        </div>
      )}

      {challenges.length > 0 && (
        <div className="grid gap-3">
          {challenges.map((c) => {
            const payout = c.stake_cents * 2 - Math.round(c.stake_cents * 2 * (feePct / 100));
            const canAfford = balance >= c.stake_cents;
            return (
              <div key={c.id} className="group rounded-xl border border-ccb-border bg-ccb-card p-4 transition-all hover:border-ccb-primary/40 hover:shadow-lg hover:shadow-ccb-primary/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-ccb-primary">
                      {c.challenger.display_name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.challenger.display_name || c.challenger.username}</span>
                      <span className={`text-xs font-bold ${getRatingColor(c.challenger.rating)}`}>{c.challenger.rating}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ccb-muted">
                      <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" />{formatMKK(c.stake_cents)}</span>
                      <span>·</span>
                      <span>Win {formatMKK(payout)}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(c.created_at)}</span>
                    </div>
                  </div>
                  <button onClick={() => handleAccept(c.id, c.stake_cents)} disabled={accepting === c.id || !canAfford}
                    className={`btn-primary px-5 py-2.5 shrink-0 ${!canAfford ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {accepting === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Swords className="w-4 h-4 mr-1.5" /> Accept</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
