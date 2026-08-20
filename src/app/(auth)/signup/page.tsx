"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Check, Loader2, AlertCircle } from "lucide-react";

type ChessLevel = "beginner" | "intermediate" | "expert";

const LEVEL_CONFIG: Record<ChessLevel, { label: string; rating: number; blurb: string; icon: string; accent: string }> = {
  beginner: {
    label: "Beginner",
    rating: 400,
    blurb: "New to chess or still learning the basics",
    icon: "♟",
    accent: "border-ccb-bronze bg-ccb-bronze/10",
  },
  intermediate: {
    label: "Intermediate",
    rating: 1500,
    blurb: "Comfortable with tactics and openings",
    icon: "♞",
    accent: "border-ccb-accent bg-ccb-accent/10",
  },
  expert: {
    label: "Expert",
    rating: 2500,
    blurb: "Experienced competitive player",
    icon: "♛",
    accent: "border-purple-500 bg-purple-500/10",
  },
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [chessLevel, setChessLevel] = useState<ChessLevel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);

  // Chess.com auto-detection state
  const [chesscomChecking, setChesscomChecking] = useState(false);
  const [chesscomVerified, setChesscomVerified] = useState<{
    username: string;
    avatar: string;
    rating: number;
    ratings: { blitz: number | null; rapid: number | null; bullet: number | null };
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedRef = useRef<string>("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const actionParam = searchParams.get("action");

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setRefCode(ref);
      localStorage.setItem("ccb_ref_code", ref);
    } else {
      const stored = localStorage.getItem("ccb_ref_code");
      if (stored) setRefCode(stored);
    }
  }, [searchParams]);

  // Auto-detect chess.com account when username changes
  const checkChesscom = useCallback(async (name: string) => {
    const clean = name.trim().toLowerCase();
    if (!clean || clean.length < 3) {
      setChesscomVerified(null);
      setChesscomChecking(false);
      return;
    }
    if (clean === lastCheckedRef.current) return;
    lastCheckedRef.current = clean;

    setChesscomChecking(true);
    setChesscomVerified(null);

    try {
      const res = await fetch("/api/chesscom/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChesscomVerified(null);
      } else {
        setChesscomVerified({
          username: data.username,
          avatar: data.avatar || "",
          rating: data.startingRating,
          ratings: {
            blitz: data.ratings?.blitz || null,
            rapid: data.ratings?.rapid || null,
            bullet: data.ratings?.bullet || null,
          },
        });
      }
    } catch {
      setChesscomVerified(null);
    } finally {
      setChesscomChecking(false);
    }
  }, []);

  // Debounced auto-detect on username change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (username.trim().length >= 3) {
      setChesscomChecking(true);
      debounceRef.current = setTimeout(() => {
        checkChesscom(username);
      }, 600);
    } else {
      setChesscomChecking(false);
      setChesscomVerified(null);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, checkChesscom]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chessLevel && !chesscomVerified) {
      setError("Please select your chess level");
      return;
    }

    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
            display_name: username.trim(),
            chess_level: chessLevel,
            chesscom_username: chesscomVerified?.username || null,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data?.user?.id) {
        setError("Signup succeeded but no user was returned. Please try logging in.");
        setLoading(false);
        return;
      }

      try {
        await fetch("/api/auth/set-rating", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: data.user.id,
            chesscomRating: chesscomVerified?.rating || null,
            chesscomUsername: chesscomVerified?.username || null,
          }),
        });

        const ref = refCode || localStorage.getItem("ccb_ref_code");
        if (ref) {
          await fetch("/api/berry/referral/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ referralCode: ref, referredId: data.user.id }),
          });
          localStorage.removeItem("ccb_ref_code");
        }
      } catch (postErr: any) {
        console.error("Post-signup error:", postErr);
      }

      const fullRedirect = actionParam
        ? `${redirectPath}?action=${actionParam}`
        : redirectPath;
      router.push(fullRedirect);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Something went wrong during signup. Please try again.");
      setLoading(false);
    }
  };

  const loginParams = new URLSearchParams();
  if (redirectPath !== "/dashboard") loginParams.set("redirect", redirectPath);
  if (actionParam) loginParams.set("action", actionParam);
  const loginLink = loginParams.toString() ? `/login?${loginParams.toString()}` : "/login";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-ccb-primary flex items-center justify-center">
              <span className="text-white font-bold text-xl">♞</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold mt-4">Join the battles</h1>
          <p className="text-sm text-ccb-muted mt-1">Create your free account</p>
          {refCode && (
            <p className="text-xs text-ccb-primary mt-2 font-medium">
              🍒 Referred by {refCode} — they&apos;ll earn 1,000 CCB when you start playing!
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-ccb-danger/10 border border-ccb-danger/30 text-ccb-danger px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="card space-y-5">
          <div>
            <label htmlFor="username" className="text-sm font-medium block mb-1.5">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input w-full pr-10"
                placeholder="Your Chess.com username or a new one"
                required
                minLength={3}
                maxLength={20}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {chesscomChecking && username.trim().length >= 3 && (
                  <Loader2 className="w-4 h-4 animate-spin text-ccb-muted" />
                )}
                {chesscomVerified && !chesscomChecking && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </div>
            </div>

            {/* Auto-detected Chess.com profile */}
            {chesscomVerified && (
              <div className="mt-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 flex items-center gap-3">
                {chesscomVerified.avatar ? (
                  <img src={chesscomVerified.avatar} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-ccb-surface border border-ccb-border flex items-center justify-center">
                    <span className="text-sm font-bold">{chesscomVerified.username?.[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    <span className="text-green-500 font-semibold">Chess.com detected</span> · {chesscomVerified.username}
                  </p>
                  <div className="flex gap-3 text-xs text-ccb-muted mt-0.5">
                    {chesscomVerified.ratings.rapid && <span>Rapid: {chesscomVerified.ratings.rapid}</span>}
                    {chesscomVerified.ratings.blitz && <span>Blitz: {chesscomVerified.ratings.blitz}</span>}
                    {chesscomVerified.ratings.bullet && <span>Bullet: {chesscomVerified.ratings.bullet}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-ccb-primary">{chesscomVerified.rating}</div>
                  <div className="text-[10px] text-ccb-muted">Starting ELO</div>
                </div>
              </div>
            )}

            {username.trim().length >= 3 && !chesscomChecking && !chesscomVerified && (
              <p className="text-xs text-ccb-muted mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Not a Chess.com account — pick your level below
              </p>
            )}

            <p className="text-xs text-ccb-muted mt-1">
              {chesscomVerified
                ? "Your Chess.com rating will be used as your starting ELO."
                : "If this matches your Chess.com username, we'll auto-detect your rating."}
            </p>
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-medium block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>

          {/* Chess Level Selector — only show if chess.com NOT auto-detected */}
          {!chesscomVerified && (
            <div>
              <label className="text-sm font-medium block mb-1.5">Your Chess Level</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(LEVEL_CONFIG) as ChessLevel[]).map((level) => {
                  const config = LEVEL_CONFIG[level];
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setChessLevel(level)}
                      className={`rounded-lg border p-3 text-center transition-all ${
                        chessLevel === level
                          ? config.accent + " ring-2 ring-offset-2 ring-offset-ccb-surface"
                          : "border-ccb-border bg-ccb-surface hover:bg-ccb-card"
                      }`}
                    >
                      <span className="text-2xl block mb-1">{config.icon}</span>
                      <span className="text-xs font-semibold block">{config.label}</span>
                      <span className="text-[10px] text-ccb-muted block mt-0.5">~{config.rating}</span>
                    </button>
                  );
                })}
              </div>
              {chessLevel && (
                <p className="text-xs text-ccb-muted mt-1.5">
                  {LEVEL_CONFIG[chessLevel].blurb}. Starting ELO: {LEVEL_CONFIG[chessLevel].rating}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!chessLevel && !chesscomVerified)}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-ccb-muted mt-6">
          Already have an account?{" "}
          <Link href={loginLink} className="text-ccb-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
