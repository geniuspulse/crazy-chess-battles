"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Swords, Clock, Zap, X, Link2, Copy, Check, Bot } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AIDifficulty } from "@/lib/game/chess-ai";

const timeControls = [
  { id: "bullet", label: "Bullet", minutes: 1, increment: 0, icon: Zap, desc: "1 min" },
  { id: "blitz3", label: "Blitz", minutes: 3, increment: 2, icon: Zap, desc: "3+2" },
  { id: "blitz", label: "Blitz", minutes: 5, increment: 0, icon: Zap, desc: "5 min" },
  { id: "rapid", label: "Rapid", minutes: 10, increment: 0, icon: Clock, desc: "10 min" },
  { id: "rapid15", label: "Rapid", minutes: 15, increment: 10, icon: Clock, desc: "15+10" },
  { id: "classical", label: "Classical", minutes: 30, increment: 0, icon: Clock, desc: "30 min" },
];

const aiDifficulties: { id: AIDifficulty; label: string; desc: string }[] = [
  { id: "easy", label: "Easy", desc: "Beginner friendly" },
  { id: "medium", label: "Medium", desc: "A fair challenge" },
  { id: "hard", label: "Hard", desc: "Think carefully" },
];

export default function PlayPage() {
  const [selectedTC, setSelectedTC] = useState<string>("blitz");
  const [rated, setRated] = useState(true);
  const [searching, setSearching] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [copied, setCopied] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [showComputer, setShowComputer] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("medium");
  const [aiColor, setAiColor] = useState<"white" | "black">("white");
  const matchChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const matchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        const channel = supabase
          .channel("matchmaking")
          .on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table: "matchmaking_queue" },
            async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
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
        matchChannelRef.current = channel;

        matchTimeoutRef.current = setTimeout(() => {
          if (matchChannelRef.current) {
            supabase.removeChannel(matchChannelRef.current);
            matchChannelRef.current = null;
          }
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
    if (matchChannelRef.current) {
      supabase.removeChannel(matchChannelRef.current);
      matchChannelRef.current = null;
    }
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }
    try {
      await fetch("/api/matchmaking/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {}
    setSearching(false);
  };

  useEffect(() => {
    return () => {
      if (matchChannelRef.current) supabase.removeChannel(matchChannelRef.current);
      if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
    };
  }, []);

  const handleCreateChallenge = async () => {
    setCreatingChallenge(true);
    try {
      const response = await fetch("/api/challenge/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: selectedTC, rated }),
      });
      const data = await response.json();
      if (data.url) setChallengeUrl(data.url);
    } catch {}
    setCreatingChallenge(false);
  };

  const handleCopyLink = () => {
    if (challengeUrl) {
      navigator.clipboard.writeText(challengeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePlayComputer = () => {
    router.push(`/play/computer?difficulty=${aiDifficulty}&color=${aiColor}&tc=${selectedTC}`);
  };

  if (searching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-slide-up">
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
        <h1 className="text-xl sm:text-2xl font-bold">Play Chess</h1>
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
                className={`tc-btn flex items-center gap-3 text-left ${isSelected ? "tc-active" : ""}`}
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
      <div className="flex items-center justify-between card card-hover">
        <div>
          <h3 className="font-medium">Ranked</h3>
          <p className="text-sm text-ccb-muted">Rated games affect your rating</p>
        </div>
        <button
          onClick={() => setRated(!rated)}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
            rated ? "bg-ccb-primary" : "bg-ccb-border"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              rated ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Play vs Computer */}
      <div className="card card-hover space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Bot className="w-4 h-4 text-ccb-primary" />
          Play vs Computer
        </h3>

        {showComputer ? (
          <>
            {/* Difficulty selection */}
            <div className="grid grid-cols-3 gap-2">
              {aiDifficulties.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setAiDifficulty(d.id)}
                  className={`tc-btn flex flex-col items-center text-center py-3 px-2 ${
                    aiDifficulty === d.id ? "tc-active" : ""
                  }`}
                >
                  <span className={`text-sm font-medium ${aiDifficulty === d.id ? "text-ccb-primary" : ""}`}>{d.label}</span>
                  <span className="text-xs text-ccb-muted mt-0.5">{d.desc}</span>
                </button>
              ))}
            </div>

            {/* Color selection */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAiColor("white")}
                className={`tc-btn flex items-center justify-center gap-2 py-2.5 ${aiColor === "white" ? "tc-active" : ""}`}
              >
                <span className="text-lg">♔</span>
                <span className="text-sm font-medium">Play as White</span>
              </button>
              <button
                onClick={() => setAiColor("black")}
                className={`tc-btn flex items-center justify-center gap-2 py-2.5 ${aiColor === "black" ? "tc-active" : ""}`}
              >
                <span className="text-lg">♚</span>
                <span className="text-sm font-medium">Play as Black</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={handlePlayComputer} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Bot className="w-4 h-4" /> Start Game
              </button>
              <button onClick={() => setShowComputer(false)} className="btn-secondary px-4">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ccb-muted">
              Practice against an AI bot. Choose your difficulty level and color.
            </p>
            <button onClick={() => setShowComputer(true)} className="btn-secondary w-full flex items-center justify-center gap-2">
              <Bot className="w-4 h-4" /> Configure Game
            </button>
          </>
        )}
      </div>

      {/* Challenge a Friend */}
      <div className="card card-hover space-y-3">
        <h3 className="font-medium flex items-center gap-2">
          <Link2 className="w-4 h-4 text-ccb-primary" />
          Challenge a Friend
        </h3>
        <p className="text-sm text-ccb-muted">
          Generate a link and share it. The game starts as soon as they accept.
        </p>
        {challengeUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={challengeUrl}
                className="input-field flex-1 text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button onClick={handleCopyLink} className="btn-secondary px-3">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
              {copied && <span className="text-xs text-green-400">Copied!</span>}
            </div>
            <a href={challengeUrl} target="_blank" className="text-xs text-ccb-primary hover:underline">
              Open challenge page →
            </a>
          </div>
        ) : (
          <button
            onClick={handleCreateChallenge}
            disabled={creatingChallenge}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {creatingChallenge ? (
              <><span className="animate-pulse">Generating...</span></>
            ) : (
              <><Link2 className="w-4 h-4" /> Generate Challenge Link</>
            )}
          </button>
        )}
      </div>

      {/* Play button */}
      <button onClick={handleQuickMatch} className="btn-play">
        <Swords className="w-5 h-5 mr-2" />
        Quick Match
      </button>
    </div>
  );
}
