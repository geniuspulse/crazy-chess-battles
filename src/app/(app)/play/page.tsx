"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AIDifficulty } from "@/lib/game/chess-ai";
import {
  Zap, Clock, Swords, Bot, Link2, Copy, Check, X,
  Users, Target, Sparkles, ChevronRight, Crown, Play,
} from "lucide-react";

const timeControls = [
  { id: "bullet",    label: "Bullet",    minutes: 1,  increment: 0,  desc: "1+0",   icon: Zap },
  { id: "blitz3",    label: "Blitz",     minutes: 3,  increment: 2,  desc: "3+2",   icon: Zap },
  { id: "blitz",     label: "Blitz",     minutes: 5,  increment: 0,  desc: "5+0",   icon: Zap },
  { id: "rapid",     label: "Rapid",     minutes: 10, increment: 0,  desc: "10+0",  icon: Clock },
  { id: "rapid15",   label: "Rapid",     minutes: 15, increment: 10, desc: "15+10", icon: Clock },
  { id: "classical", label: "Classical", minutes: 30, increment: 0,  desc: "30+0",  icon: Clock },
];

const aiDifficulties: { id: AIDifficulty; label: string; desc: string }[] = [
  { id: "easy",   label: "Easy",   desc: "Beginner friendly" },
  { id: "medium", label: "Medium", desc: "A fair challenge" },
  { id: "hard",   label: "Hard",   desc: "Think carefully" },
];

type Mode = "menu" | "quickmatch" | "challenge" | "computer";
type SearchState = "idle" | "searching" | "noPlayers";

export default function PlayPage() {
  const [mode, setMode] = useState<Mode>("menu");
  const [selectedTC, setSelectedTC] = useState("blitz");
  const [rated, setRated] = useState(true);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adminNotified, setAdminNotified] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("medium");
  const [aiColor, setAiColor] = useState<"white" | "black">("white");
  const [searchSeconds, setSearchSeconds] = useState(0);
  const matchChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const matchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const cleanupSearch = () => {
    if (matchChannelRef.current) {
      supabase.removeChannel(matchChannelRef.current);
      matchChannelRef.current = null;
    }
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }
    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current);
      searchIntervalRef.current = null;
    }
  };

  const handleQuickMatch = async () => {
    setSearchState("searching");
    setSearchSeconds(0);
    setAdminNotified(false);

    searchIntervalRef.current = setInterval(() => {
      setSearchSeconds((s) => s + 1);
    }, 1000);

    try {
      const response = await fetch("/api/matchmaking/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: selectedTC, rated }),
      });
      const data = await response.json();

      if (data.status === "matched" && data.gameId) {
        cleanupSearch();
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
                cleanupSearch();
                router.push(`/game/${newGame.id}`);
              }
            }
          )
          .subscribe();
        matchChannelRef.current = channel;

        // After 20 seconds with no match — notify admin, then show fallback
        matchTimeoutRef.current = setTimeout(async () => {
          cleanupSearch();
          // Leave the matchmaking queue
          fetch("/api/matchmaking/leave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }).catch(() => {});

          // Notify admin that a player is waiting
          try {
            await fetch("/api/notify-admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ timeControl: selectedTC, rated }),
            });
            setAdminNotified(true);
          } catch {}

          setSearchState("noPlayers");
        }, 20000);
        return;
      }

      if (data.error) {
        cleanupSearch();
        setSearchState("idle");
        alert(data.error);
      }
    } catch {
      cleanupSearch();
      setSearchState("idle");
    }
  };

  const handleCancel = async () => {
    cleanupSearch();
    try {
      await fetch("/api/matchmaking/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {}
    setSearchState("idle");
  };

  const handlePlayBot = () => {
    const color = Math.random() < 0.5 ? "white" : "black";
    router.push(`/play/computer?difficulty=${aiDifficulty}&color=${color}&tc=${selectedTC}`);
  };

  const handlePlayComputer = () => {
    router.push(`/play/computer?difficulty=${aiDifficulty}&color=${aiColor}&tc=${selectedTC}`);
  };

  useEffect(() => {
    return () => cleanupSearch();
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

  // ===== Searching state =====
  if (searchState === "searching") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 animate-slide-up">
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-ccb-primary/10 flex items-center justify-center animate-pulse-glow">
            <Swords className="w-14 h-14 text-ccb-primary" />
          </div>
          {/* Orbital dots */}
          <div className="absolute inset-0 rounded-full border-2 border-ccb-primary/20 border-t-ccb-primary animate-spin" style={{ animationDuration: "1.5s" }} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-1">Finding opponent...</h2>
          <p className="text-sm text-ccb-muted">
            {timeControls.find((t) => t.id === selectedTC)?.desc} · {rated ? "Ranked" : "Casual"}
          </p>
          <p className="text-xs text-ccb-muted mt-2 tabular-nums">{searchSeconds}s elapsed</p>
        </div>
        <button onClick={handleCancel} className="btn-secondary px-8">
          <X className="w-4 h-4 mr-1.5" /> Cancel Search
        </button>
      </div>
    );
  }

  // ===== No players found — fallback =====
  if (searchState === "noPlayers") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6 animate-slide-up px-4">
        <div className="w-24 h-24 rounded-full bg-ccb-primary/10 flex items-center justify-center">
          <Bot className="w-12 h-12 text-ccb-primary" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">No players online right now</h2>
          <p className="text-sm text-ccb-muted max-w-sm">
            We couldn't find an opponent in the queue. Play the computer while you wait — same time control.
          </p>
        </div>

        {/* Admin notification badge */}
        {adminNotified && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-ccb-primary/10 border border-ccb-primary/30 text-xs text-ccb-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>We've notified the admin — they may join to play you!</span>
          </div>
        )}

        {/* Difficulty picker */}
        <div className="flex gap-2">
          {aiDifficulties.map((d) => (
            <button
              key={d.id}
              onClick={() => setAiDifficulty(d.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                aiDifficulty === d.id
                  ? "bg-ccb-primary text-white shadow-lg shadow-ccb-primary/20"
                  : "bg-ccb-card border border-ccb-border text-ccb-muted hover:text-ccb-text"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handlePlayBot} className="btn-primary px-8">
            <Bot className="w-4 h-4 mr-1.5" /> Play Computer
          </button>
          <button onClick={() => { setSearchState("idle"); setMode("menu"); }} className="btn-secondary px-6">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // ===== Mode: Quick Match (time selection + search) =====
  if (mode === "quickmatch") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20 sm:pb-0 animate-slide-up">
        <button onClick={() => setMode("menu")} className="text-sm text-ccb-muted hover:text-ccb-text flex items-center gap-1">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back
        </button>

        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-ccb-primary/15 flex items-center justify-center">
              <Swords className="w-5 h-5 text-ccb-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Quick Match</h1>
              <p className="text-sm text-ccb-muted">Auto-matched with a player of similar rating</p>
            </div>
          </div>
        </div>

        <TimeControlPicker selectedTC={selectedTC} setSelectedTC={setSelectedTC} />

        <RatedToggle rated={rated} setRated={setRated} />

        <button onClick={handleQuickMatch} className="btn-primary w-full text-base py-3.5 text-lg">
          <Swords className="w-5 h-5 mr-2" /> Find Match
        </button>

        <p className="text-xs text-ccb-muted text-center">
          If no opponent is found within 20 seconds, you'll get the option to play the computer.
          The admin will also be notified that you're looking for a game.
        </p>
      </div>
    );
  }

  // ===== Mode: Create Challenge =====
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
              <h1 className="text-xl sm:text-2xl font-bold">Create a Challenge</h1>
              <p className="text-sm text-ccb-muted">Pick your settings, share the link, and wait for a challenger</p>
            </div>
          </div>
        </div>

        <TimeControlPicker selectedTC={selectedTC} setSelectedTC={setSelectedTC} />

        <RatedToggle rated={rated} setRated={setRated} />

        {challengeUrl ? (
          <div className="card space-y-4">
            <div className="flex items-center gap-2 text-sm text-ccb-primary font-medium">
              <Check className="w-4 h-4" /> Challenge created!
            </div>
            <p className="text-sm text-ccb-muted">Share this link with your friend:</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={challengeUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="input-field flex-1 text-xs"
              />
              <button onClick={handleCopyLink} className="btn-secondary shrink-0 px-3">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copied && <p className="text-xs text-green-400">Copied to clipboard!</p>}
            <p className="text-xs text-ccb-muted">
              The game starts automatically when someone accepts.
            </p>
            <button onClick={() => { setChallengeUrl(null); setMode("menu"); }} className="btn-secondary w-full">
              Create Another
            </button>
          </div>
        ) : (
          <button onClick={handleCreateChallenge} disabled={creatingChallenge} className="btn-primary w-full text-base py-3.5">
            <Link2 className="w-5 h-5 mr-2" /> {creatingChallenge ? "Creating..." : "Create Challenge Link"}
          </button>
        )}

        <div className="text-center">
          <button onClick={() => router.push("/challenges")} className="text-sm text-ccb-primary hover:underline">
            Browse open challenges from other players →
          </button>
        </div>
      </div>
    );
  }

  // ===== Mode: Play vs Computer =====
  if (mode === "computer") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20 sm:pb-0 animate-slide-up">
        <button onClick={() => setMode("menu")} className="text-sm text-ccb-muted hover:text-ccb-text flex items-center gap-1">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back
        </button>

        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-ccb-success/15 flex items-center justify-center">
              <Bot className="w-5 h-5 text-ccb-success" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Play vs Computer</h1>
              <p className="text-sm text-ccb-muted">Hone your skills against the AI</p>
            </div>
          </div>
        </div>

        <TimeControlPicker selectedTC={selectedTC} setSelectedTC={setSelectedTC} />

        {/* Difficulty */}
        <div>
          <h3 className="text-sm font-medium text-ccb-muted mb-3">Difficulty</h3>
          <div className="grid grid-cols-3 gap-3">
            {aiDifficulties.map((d) => (
              <button
                key={d.id}
                onClick={() => setAiDifficulty(d.id)}
                className={`tc-btn flex flex-col items-center text-center py-4 px-2 ${aiDifficulty === d.id ? "tc-active" : ""}`}
              >
                <span className={`text-sm font-medium ${aiDifficulty === d.id ? "text-ccb-primary" : ""}`}>{d.label}</span>
                <span className="text-xs text-ccb-muted mt-0.5">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <h3 className="text-sm font-medium text-ccb-muted mb-3">Your Color</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAiColor("white")}
              className={`tc-btn flex items-center justify-center gap-2 py-3.5 ${aiColor === "white" ? "tc-active" : ""}`}
            >
              <span className="text-xl">♔</span>
              <span className="text-sm font-medium">White</span>
            </button>
            <button
              onClick={() => setAiColor("black")}
              className={`tc-btn flex items-center justify-center gap-2 py-3.5 ${aiColor === "black" ? "tc-active" : ""}`}
            >
              <span className="text-xl">♚</span>
              <span className="text-sm font-medium">Black</span>
            </button>
          </div>
        </div>

        <button onClick={handlePlayComputer} className="btn-primary w-full text-base py-3.5">
          <Play className="w-5 h-5 mr-2" /> Start Game
        </button>
      </div>
    );
  }

  // ===== Main mode menu =====
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 sm:pb-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Play Chess</h1>
        <p className="text-sm text-ccb-muted mt-1">Choose your game mode and start playing</p>
      </div>

      {/* Mode cards */}
      <div className="grid gap-4">
        {/* Quick Match */}
        <button
          onClick={() => { setMode("quickmatch"); setSearchState("idle"); }}
          className="group relative overflow-hidden rounded-2xl border border-ccb-border bg-ccb-card p-6 text-left transition-all hover:border-ccb-primary/50 hover:shadow-xl hover:shadow-ccb-primary/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-ccb-primary to-ccb-primaryHover flex items-center justify-center shrink-0">
              <Swords className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold flex items-center gap-2">
                Quick Match
                <span className="badge bg-ccb-primary/15 text-ccb-primary text-[10px] px-2 py-0.5">AUTO</span>
              </h2>
              <p className="text-sm text-ccb-muted mt-0.5">
                Get matched instantly with a player of similar rating. Pick your time control and jump in.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-ccb-muted group-hover:text-ccb-primary transition-colors shrink-0" />
          </div>
        </button>

        {/* Create Challenge */}
        <button
          onClick={() => setMode("challenge")}
          className="group relative overflow-hidden rounded-2xl border border-ccb-border bg-ccb-card p-6 text-left transition-all hover:border-ccb-accent/50 hover:shadow-xl hover:shadow-ccb-accent/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-ccb-accent to-amber-600 flex items-center justify-center shrink-0">
              <Link2 className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold flex items-center gap-2">
                Create a Challenge
                <span className="badge bg-ccb-accent/15 text-ccb-accent text-[10px] px-2 py-0.5">SHARE</span>
              </h2>
              <p className="text-sm text-ccb-muted mt-0.5">
                Set up a game with your preferred rules and share a link with a friend. Appears in the Challenges tab.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-ccb-muted group-hover:text-ccb-accent transition-colors shrink-0" />
          </div>
        </button>

        {/* Play vs Computer */}
        <button
          onClick={() => setMode("computer")}
          className="group relative overflow-hidden rounded-2xl border border-ccb-border bg-ccb-card p-6 text-left transition-all hover:border-ccb-success/50 hover:shadow-xl hover:shadow-ccb-success/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-ccb-success to-emerald-700 flex items-center justify-center shrink-0">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold flex items-center gap-2">
                Play vs Computer
                <span className="badge bg-ccb-success/15 text-ccb-success text-[10px] px-2 py-0.5">PRACTICE</span>
              </h2>
              <p className="text-sm text-ccb-muted mt-0.5">
                Train against the AI with adjustable difficulty. Great for warming up or trying new openings.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-ccb-muted group-hover:text-ccb-success transition-colors shrink-0" />
          </div>
        </button>
      </div>

      {/* Quick links */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={() => router.push("/challenges")}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-ccb-border bg-ccb-surface px-4 py-3 text-sm font-medium text-ccb-text hover:border-ccb-primary/40 transition-colors"
        >
          <Users className="w-4 h-4 text-ccb-primary" />
          Browse Open Challenges
        </button>
        <button
          onClick={() => router.push("/battles")}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-ccb-border bg-ccb-surface px-4 py-3 text-sm font-medium text-ccb-text hover:border-ccb-accent/40 transition-colors"
        >
          <Target className="w-4 h-4 text-ccb-accent" />
          Staked Battles
        </button>
      </div>
    </div>
  );
}

// ===== Reusable Time Control Picker =====
function TimeControlPicker({ selectedTC, setSelectedTC }: { selectedTC: string; setSelectedTC: (v: string) => void }) {
  return (
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
  );
}

// ===== Reusable Rated Toggle =====
function RatedToggle({ rated, setRated }: { rated: boolean; setRated: (v: boolean) => void }) {
  return (
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
  );
}
