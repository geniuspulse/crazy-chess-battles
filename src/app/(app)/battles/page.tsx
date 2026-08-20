"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Swords, Clock, Coins, Zap, AlertCircle, Loader2, Link2, Copy, Check } from "lucide-react";

const DEFAULT_STAKES = [50000, 100000, 250000, 500000, 1000000];

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

type BattleState = "select" | "searching" | "matched" | "playing";

export default function BattlesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [config, setConfig] = useState<BattleConfig | null>(null);
  const [balance, setBalance] = useState(0);
  const [selectedStake, setSelectedStake] = useState<number | null>(null);
  const [state, setState] = useState<BattleState>("select");
  const [battleId, setBattleId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<{ username: string; display_name: string; rating: number } | null>(null);
  const [myRating, setMyRating] = useState(1200);
  const [error, setError] = useState<string | null>(null);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadConfig();
    loadProfile();
  }, []);

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

  // Poll for match while searching
  useEffect(() => {
    if (state !== "searching") return;

    searchIntervalRef.current = setInterval(() => {
      setSearchSeconds((s) => s + 1);
    }, 1000);

    pollRef.current = setInterval(async () => {
      // Check if we got matched
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
        // Fetch battle details
        const res = await fetch(`/api/battles/status?battleId=${queueEntry.battle_id}`);
        if (res.ok) {
          const battleData = await res.json();
          setBattleId(queueEntry.battle_id);
          setOpponent(battleData.opponent);
          setState("matched");
        }
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    };
  }, [state]);

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
        body: JSON.stringify({ stakeCents: selectedStake }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join battle");
        return;
      }

      if (data.matched && data.battleId) {
        // Instant match
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
      }
    } catch {
      setError("Failed to join battle queue");
    }
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
        body: JSON.stringify({ stakeCents: selectedStake }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create challenge");
        setCreatingChallenge(false);
        return;
      }

      // Stake is now locked — go to the waiting screen and share the link from there
      router.push(`/battle-challenge/${data.challengeId}`);
    } catch {
      setError("Failed to create challenge");
      setCreatingChallenge(false);
    }
  };

  const handleLeaveQueue = async () => {
    await fetch("/api/battles/leave", { method: "POST" });
    setState("select");
    setSearchSeconds(0);
    loadProfile();
  };

  const handlePlayBattle = async () => {
    if (!battleId) return;

    try {
      const res = await fetch("/api/battles/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start game");
        return;
      }

      // Navigate to the game
      router.push(`/game/${data.gameId}`);
    } catch {
      setError("Failed to start battle game");
    }
  };

  const stakes = config?.stake_levels ?? DEFAULT_STAKES;
  const feePct = config?.platform_fee_pct ?? 10;

  if (!config?.enabled && config !== null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertCircle className="w-12 h-12 text-ccb-muted mb-4" />
        <p className="text-lg font-semibold text-ccb-text">Chess Battles are currently disabled</p>
        <p className="text-sm text-ccb-muted mt-2">Check back later or contact an admin.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 sm:py-10 sm:pb-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-2">
          <Swords className="w-7 h-7 text-ccb-primary" />
          <h1 className="text-2xl font-bold text-ccb-text">Chess Battles</h1>
        </div>
        <p className="text-sm text-ccb-muted">Stake your coins. Beat your opponent. Win the pot.</p>
        <div className="mt-3 flex items-center justify-center gap-4 text-sm">
          <span className="text-ccb-muted">Balance: <span className="font-semibold text-ccb-text">{formatMKK(balance)}</span></span>
          <span className="text-ccb-muted">Your Rating: <span className="font-semibold text-ccb-text">{myRating}</span></span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* State: Select stake */}
      {state === "select" && (
        <div>
          <p className="text-sm font-medium text-ccb-muted mb-3 text-center">Choose your stake:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stakes.map((stake) => {
              const { pot, fee, payout } = {
                pot: stake * 2,
                fee: Math.round(stake * 2 * (feePct / 100)),
                payout: stake * 2 - Math.round(stake * 2 * (feePct / 100)),
              };
              const isSelected = selectedStake === stake;
              const canAfford = balance >= stake;
              return (
                <button
                  key={stake}
                  onClick={() => canAfford && setSelectedStake(stake)}
                  disabled={!canAfford}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    isSelected
                      ? "border-ccb-primary bg-ccb-primary/10"
                      : canAfford
                        ? "border-ccb-border bg-ccb-surface hover:border-ccb-primary/50"
                        : "border-ccb-border bg-ccb-surface/50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <Coins className={`w-5 h-5 mx-auto mb-2 ${isSelected ? "text-ccb-primary" : "text-ccb-muted"}`} />
                  <p className={`font-bold text-lg ${isSelected ? "text-ccb-primary" : "text-ccb-text"}`}>
                    {formatMKK(stake)}
                  </p>
                  <p className="text-xs text-ccb-muted mt-1">
                    Win {formatMKK(payout)}
                  </p>
                  {!canAfford && (
                    <p className="text-xs text-red-400 mt-1">Insufficient</p>
                  )}
                </button>
              );
            })}
          </div>

          {selectedStake !== null && (
            <div className="mt-6 p-4 rounded-xl bg-ccb-surface border border-ccb-border">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-ccb-muted">Your stake</span>
                <span className="font-semibold text-ccb-text">{formatMKK(selectedStake)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-ccb-muted">Total pot</span>
                <span className="font-semibold text-ccb-text">{formatMKK(selectedStake * 2)}</span>
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

          <button
            onClick={handleEnterBattle}
            disabled={selectedStake === null}
            className="w-full mt-6 py-4 rounded-xl font-bold text-white bg-ccb-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ccb-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Swords className="w-5 h-5" />
            ENTER BATTLE
          </button>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-px bg-ccb-border" />
            <span className="text-xs text-ccb-muted">or</span>
            <div className="flex-1 h-px bg-ccb-border" />
          </div>

          {challengeUrl ? (
            <div className="mt-3 p-3 rounded-xl bg-ccb-surface border border-ccb-border">
              <p className="text-xs text-ccb-muted mb-2">Share this link with your friend:</p>
              <div className="flex items-center gap-2">
                <input readOnly value={challengeUrl} className="input-field flex-1 text-xs" onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(challengeUrl);
                    setChallengeCopied(true);
                    setTimeout(() => setChallengeCopied(false), 2000);
                  }}
                  className="btn-secondary px-3 shrink-0"
                >
                  {challengeCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleChallengeFriend}
              disabled={selectedStake === null || creatingChallenge}
              className="w-full mt-3 py-3.5 rounded-xl font-semibold text-ccb-text bg-ccb-surface border border-ccb-border disabled:opacity-50 disabled:cursor-not-allowed hover:border-ccb-primary/50 transition-colors flex items-center justify-center gap-2"
            >
              {creatingChallenge ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {creatingChallenge ? "Creating link..." : "Challenge a Friend"}
            </button>
          )}
        </div>
      )}

      {/* State: Searching for opponent */}
      {state === "searching" && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-ccb-primary animate-spin" />
              <Swords className="w-6 h-6 text-ccb-primary absolute inset-0 m-auto" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-ccb-text mb-2">
            {formatMKK(selectedStake!)} Battle
          </h2>
          <p className="text-ccb-muted mb-1">Searching for opponent...</p>
          <p className="text-sm text-ccb-muted">{searchSeconds}s elapsed</p>

          <div className="mt-8 p-4 rounded-xl bg-ccb-surface border border-ccb-border max-w-xs mx-auto">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ccb-muted">Your stake locked</span>
              <span className="font-semibold text-ccb-text">{formatMKK(selectedStake!)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ccb-muted">Win potential</span>
              <span className="font-semibold text-ccb-primary">
                {formatMKK(selectedStake! * 2 - Math.round(selectedStake! * 2 * (feePct / 100)))}
              </span>
            </div>
          </div>

          <button
            onClick={handleLeaveQueue}
            className="mt-8 px-6 py-3 rounded-xl font-medium text-ccb-muted bg-ccb-surface border border-ccb-border hover:text-ccb-text transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* State: Matched */}
      {state === "matched" && opponent && (
        <div className="text-center py-8">
          <div className="mb-2 inline-block">
            <span className="px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium">
              OPPONENT FOUND
            </span>
          </div>

          <div className="flex items-center justify-center gap-6 sm:gap-12 my-8">
            {/* Player A */}
            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-ccb-surface border-2 border-ccb-border flex items-center justify-center mx-auto mb-2">
                <span className="text-xl font-bold text-ccb-text">
                  {(opponent.display_name || opponent.username || "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="font-semibold text-ccb-text text-sm sm:text-base">
                {opponent.display_name || opponent.username}
              </p>
              <p className="text-ccb-muted text-xs sm:text-sm">{opponent.rating} Rating</p>
            </div>

            {/* VS */}
            <div className="text-center">
              <span className="text-2xl font-bold text-ccb-muted">VS</span>
            </div>

            {/* Player B (me) */}
            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-ccb-primary/10 border-2 border-ccb-primary flex items-center justify-center mx-auto mb-2">
                <span className="text-xl font-bold text-ccb-primary">You</span>
              </div>
              <p className="font-semibold text-ccb-text text-sm sm:text-base">You</p>
              <p className="text-ccb-muted text-xs sm:text-sm">{myRating} Rating</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-ccb-surface border border-ccb-border max-w-xs mx-auto">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ccb-muted">Stake</span>
              <span className="font-semibold text-ccb-text">{formatMKK(selectedStake!)} each</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ccb-muted">Winner receives</span>
              <span className="font-bold text-ccb-primary">
                {formatMKK(selectedStake! * 2 - Math.round(selectedStake! * 2 * (feePct / 100)))}
              </span>
            </div>
          </div>

          <button
            onClick={handlePlayBattle}
            className="mt-8 px-10 py-4 rounded-xl font-bold text-white bg-ccb-primary hover:bg-ccb-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <Swords className="w-5 h-5" />
            PLAY BATTLE
          </button>
        </div>
      )}
    </div>
  );
}
