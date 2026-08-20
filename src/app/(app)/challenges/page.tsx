"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Swords, Clock, Zap, Link2, RefreshCw, Loader2, Users, Star, Coins, ChevronRight,
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

function formatMKK(cents: number): string {
  return `MK ${Math.floor(cents / 100).toLocaleString()}`;
}

export default function ChallengesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
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

      // Fetch free challenges and battle challenges in parallel
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

      // Collect all challenger IDs from both lists
      const challengerIds = new Set<string>();
      (freeRes.data || []).forEach((c: any) => challengerIds.add(c.challenger_id));
      (battleRes.data || []).forEach((c: any) => challengerIds.add(c.challenger_id));

      if (challengerIds.size === 0) {
        setChallenges([]);
        setLoading(false);
        return;
      }

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, rating")
        .in("id", Array.from(challengerIds));

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Build free challenge list
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

      // Build battle challenge list
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

      // Merge and sort by created_at desc
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

    const channel = supabase
      .channel("all-challenges-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "challenges" }, () => fetchChallenges())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "challenges" }, () => fetchChallenges())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_challenges" }, () => fetchChallenges())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battle_challenges" }, () => fetchChallenges())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchChallenges, supabase]);

  // Optimistic removal when accepting
  const removeChallenge = (id: string) => {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  };

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

  const handleAcceptBattle = async (challengeId: string) => {
    setAccepting(challengeId);
    setError(null);
    try {
      const res = await fetch("/api/battles/challenge/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to accept battle");
      removeChallenge(challengeId);

      // Start the battle game
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
      // Retry once
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
        <button onClick={fetchChallenges} className="btn-secondary px-3 py-2" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
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
                              <Coins className="w-3.5 h-3.5 shrink-0" />{formatMKK(c.stake_cents)}
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
                    onClick={() => isBattle ? handleAcceptBattle(c.id) : handleAcceptFree(c.id)}
                    disabled={acceptingThis}
                    className={`btn-primary w-full sm:w-auto px-5 py-2.5 shrink-0 ${
                      isBattle ? "" : ""
                    }`}
                  >
                    {acceptingThis ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      <><Swords className="w-4 h-4 mr-1.5" /> Accept</>
                    )}
                  </button>
                </div>
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
