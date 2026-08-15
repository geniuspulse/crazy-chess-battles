"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Swords, Clock, Zap, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const timeControls = [
  { id: "bullet", label: "Bullet", minutes: 1, increment: 0, icon: Zap, desc: "1 min" },
  { id: "blitz3", label: "Blitz", minutes: 3, increment: 2, icon: Zap, desc: "3+2" },
  { id: "blitz", label: "Blitz", minutes: 5, increment: 0, icon: Zap, desc: "5 min" },
  { id: "rapid", label: "Rapid", minutes: 10, increment: 0, icon: Clock, desc: "10 min" },
  { id: "rapid15", label: "Rapid", minutes: 15, increment: 10, icon: Clock, desc: "15+10" },
  { id: "classical", label: "Classical", minutes: 30, increment: 0, icon: Clock, desc: "30 min" },
];

export default function PlayPage() {
  const [selectedTC, setSelectedTC] = useState<string>("blitz");
  const [rated, setRated] = useState(true);
  const [searching, setSearching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleQuickMatch = async () => {
    setSearching(true);
    setMatchError(null);

    try {
      const response = await fetch("/api/matchmaking/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: selectedTC, rated }),
      });

      const data = await response.json();

      if (data.status === "matched" && data.gameId) {
        router.push(`/game/${data.gameId}`);
        return;
      }

      if (data.status === "searching") {
        // Subscribe to real-time to wait for match
        const channel = supabase
          .channel("matchmaking")
          .on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table: "matchmaking_queue" },
            async () => {
              // Check if we've been matched
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // Look for a new game where we're a player
              const { data: newGame } = await supabase
                .from("games")
                .select("id")
                .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
                .eq("status", "playing")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              if (newGame) {
                supabase.removeChannel(channel);
                router.push(`/game/${newGame.id}`);
              }
            }
          )
          .subscribe();

        // Timeout after 60s
        setTimeout(() => {
          supabase.removeChannel(channel);
          setSearching(false);
          setMatchError("No opponent found. Try again!");
        }, 60000);

        return;
      }

      if (data.error) {
        setMatchError(data.error);
        setSearching(false);
      }
    } catch {
      setMatchError("Network error. Try again.");
      setSearching(false);
    }
  };

  const handleCancel = async () => {
    try {
      await fetch("/api/matchmaking/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // ignore
    }
    setSearching(false);
  };

  if (searching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-ccb-primary/10 flex items-center justify-center animate-pulse-glow">
            <Swords className="w-12 h-12 text-ccb-primary" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-1">Finding opponent...</h2>
          <p className="text-sm text-ccb-muted">
            {timeControls.find((t) => t.id === selectedTC)?.desc} · {rated ? "Ranked" : "Casual"}
          </p>
        </div>
        <button onClick={handleCancel} className="btn-secondary">
          <X className="w-4 h-4 mr-1" /> Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Play Chess</h1>
        <p className="text-sm text-ccb-muted mt-1">Choose your time control and find an opponent</p>
      </div>

      {matchError && (
        <div className="rounded-lg bg-ccb-danger/10 border border-ccb-danger/30 text-ccb-danger px-4 py-3 text-sm">
          {matchError}
        </div>
      )}

      {/* Time control selection */}
      <div>
        <h3 className="text-sm font-medium text-ccb-muted mb-3">Time Control</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {timeControls.map((tc) => {
            const Icon = tc.icon;
            const isSelected = selectedTC === tc.id;
            return (
              <button
                key={tc.id}
                onClick={() => setSelectedTC(tc.id)}
                className={`card flex items-center gap-3 transition-all text-left ${
                  isSelected
                    ? "border-ccb-primary ring-2 ring-ccb-primary/30"
                    : "hover:border-ccb-border"
                }`}
              >
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

      {/* Rated toggle */}
      <div className="flex items-center justify-between card">
        <div>
          <h3 className="font-medium">Ranked</h3>
          <p className="text-sm text-ccb-muted">Rated games affect your rating</p>
        </div>
        <button
          onClick={() => setRated(!rated)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            rated ? "bg-ccb-primary" : "bg-ccb-border"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              rated ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Play button */}
      <button onClick={handleQuickMatch} className="btn-primary w-full text-base py-3">
        <Swords className="w-5 h-5 mr-2" />
        Quick Match
      </button>
    </div>
  );
}
