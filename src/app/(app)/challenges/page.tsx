"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Swords, Clock, Zap, Link2, RefreshCw, ChevronRight, Loader2, Users, Star } from "lucide-react";

interface Challenge {
  id: string;
  time_control: string;
  initial_minutes: number;
  increment_seconds: number;
  rated: boolean;
  created_at: string;
  challenger: {
    username: string;
    display_name: string;
    rating: number;
  };
}

const TC_ICONS: Record<string, any> = {
  bullet: Zap,
  blitz3: Zap,
  blitz: Zap,
  rapid: Clock,
  rapid15: Clock,
  classical: Clock,
};

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

      // Fetch pending challenges
      const { data, error: fetchError } = await supabase
        .from("challenges")
        .select(`
          id, time_control, initial_minutes, increment_seconds, rated, created_at, challenger_id
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(30);

      if (fetchError) throw fetchError;
      if (!data || data.length === 0) {
        setChallenges([]);
        setLoading(false);
        return;
      }

      // Fetch challenger profiles
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

      setChallenges(enriched);
    } catch (e: any) {
      setError(e.message || "Failed to load challenges");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchChallenges();

    // Realtime: listen for new challenges
    const channel = supabase
      .channel("challenges-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "challenges" }, () => {
        fetchChallenges();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "challenges" }, () => {
        fetchChallenges();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchChallenges]);

  const handleAccept = async (challengeId: string) => {
    setAccepting(challengeId);
    setError(null);
    try {
      const res = await fetch("/api/challenge/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to accept challenge");
      }
      if (data.gameId) {
        router.push(`/game/${data.gameId}`);
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

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-20 sm:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-ccb-primary" />
            Open Challenges
          </h1>
          <p className="text-sm text-ccb-muted mt-1">Join a game created by another player</p>
        </div>
        <button onClick={fetchChallenges} className="btn-secondary px-3 py-2" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && challenges.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-ccb-primary animate-spin" />
          <p className="text-sm text-ccb-muted mt-3">Loading challenges...</p>
        </div>
      )}

      {/* Empty */}
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

      {/* Challenge list */}
      {challenges.length > 0 && (
        <div className="grid gap-3">
          {challenges.map((c) => {
            const Icon = TC_ICONS[c.time_control] || Clock;
            return (
              <div
                key={c.id}
                className="group rounded-xl border border-ccb-border bg-ccb-card p-4 transition-all hover:border-ccb-primary/40 hover:shadow-lg hover:shadow-ccb-primary/5"
              >
                <div className="flex items-center gap-4">
                  {/* Player avatar */}
                  <div className="w-12 h-12 rounded-full bg-ccb-surface border border-ccb-border flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-ccb-primary">
                      {c.challenger.display_name?.[0]?.toUpperCase() || c.challenger.username?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.challenger.display_name || c.challenger.username}</span>
                      <span className={`text-xs font-bold ${getRatingColor(c.challenger.rating)}`}>
                        {c.challenger.rating}
                      </span>
                      {c.rated && (
                        <span className="badge bg-ccb-accent/15 text-ccb-accent text-[10px] px-1.5 py-0.5">
                          <Star className="w-2.5 h-2.5 inline mr-0.5" />Ranked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ccb-muted">
                      <span className="flex items-center gap-1">
                        <Icon className="w-3.5 h-3.5" />
                        {c.initial_minutes}+{c.increment_seconds}
                      </span>
                      <span>·</span>
                      <span>{formatTimeAgo(c.created_at)}</span>
                    </div>
                  </div>

                  {/* Accept button */}
                  <button
                    onClick={() => handleAccept(c.id)}
                    disabled={accepting === c.id}
                    className="btn-primary px-5 py-2.5 shrink-0"
                  >
                    {accepting === c.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Swords className="w-4 h-4 mr-1.5" /> Accept
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer link */}
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
