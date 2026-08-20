"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Search, Check, X, Loader2 } from "lucide-react";

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

  // Chess.com verification state
  const [chesscomUsername, setChesscomUsername] = useState("");
  const [chesscomVerifying, setChesscomVerifying] = useState(false);
  const [chesscomVerified, setChesscomVerified] = useState<any>(null);
  const [chesscomError, setChesscomError] = useState<string | null>(null);

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

  const verifyChesscom = async () => {
    if (!chesscomUsername.trim()) return;
    setChesscomVerifying(true);
    setChesscomError(null);
    setChesscomVerified(null);
    try {
      const res = await fetch("/api/chesscom/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: chesscomUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChesscomError(data.error || "Verification failed");
      } else {
        setChesscomVerified(data);
      }
    } catch {
      setChesscomError("Failed to connect to Chess.com. You can skip this and pick a level instead.");
    } finally {
      setChesscomVerifying(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chessLevel && !chesscomVerified) {
      setError("Please verify your Chess.com account or select your chess level");
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

      // Set initial ELO — use chess.com rating if verified, otherwise level-based
      try {
        await fetch("/api/auth/set-rating", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: data.user.id,
            chesscomRating: chesscomVerified?.startingRating || null,
            chesscomUsername: chesscomVerified?.username || null,
          }),
        });

        // Create referral record if we have a ref code
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
        // Non-critical — user is already signed up
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
              🍒 Referred by {refCode} — they'll earn 1,000 CCB when you start playing!
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
            <label htmlFor="username" className="text-sm font-medium block mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="ChessWarrior42"
              required
              minLength={3}
              maxLength={20}
            />
            <p className="text-xs text-ccb-muted mt-1">This will also be your referral code.</p>
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

          {/* Chess.com Verification Section */}
          <div>
            <label className="text-sm font-medium block mb-1.5">
              Chess.com Username <span className="text-ccb-muted font-normal">(optional — for accurate rating)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={chesscomUsername}
                onChange={(e) => {
                  setChesscomUsername(e.target.value);
                  setChesscomVerified(null);
                  setChesscomError(null);
                }}
                className="input flex-1"
                placeholder="e.g. magnuscarlsen"
              />
              <button
                type="button"
                onClick={verifyChesscom}
                disabled={chesscomVerifying || !chesscomUsername.trim()}
                className="btn-secondary px-4 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {chesscomVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-1.5 text-sm">{chesscomVerifying ? "..." : "Verify"}</span>
              </button>
            </div>

            {/* Verification result */}
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{chesscomVerified.username}</span>
                    <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ccb-muted mt-0.5">
                    {chesscomVerified.ratings?.blitz && <span>Blitz: {chesscomVerified.ratings.blitz}</span>}
                    {chesscomVerified.ratings?.rapid && <span>Rapid: {chesscomVerified.ratings.rapid}</span>}
                    {chesscomVerified.ratings?.bullet && <span>Bullet: {chesscomVerified.ratings.bullet}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-ccb-primary">{chesscomVerified.startingRating}</div>
                  <div className="text-[10px] text-ccb-muted">Start ELO</div>
                </div>
              </div>
            )}

            {chesscomError && (
              <div className="mt-2 rounded-lg bg-ccb-danger/10 border border-ccb-danger/30 text-ccb-danger px-3 py-2 text-xs flex items-center gap-1.5">
                <X className="w-3.5 h-3.5 shrink-0" /> {chesscomError}
              </div>
            )}

            {chesscomVerified && (
              <p className="text-xs text-green-500 mt-1.5 flex items-center gap-1">
                <Check className="w-3 h-3" /> Your starting rating will be {chesscomVerified.startingRating} ELO (from Chess.com {chesscomVerified.ratings?.rapid ? "Rapid" : chesscomVerified.ratings?.blitz ? "Blitz" : chesscomVerified.ratings?.bullet ? "Bullet" : "Daily"})
              </p>
            )}
          </div>

          {/* Chess Level Selector — only show if chess.com not verified */}
          {!chesscomVerified && (
            <div>
              <label className="text-sm font-medium block mb-2">
                Your Chess Level <span className="text-ccb-muted font-normal">(or verify Chess.com above)</span>
              </label>
              <p className="text-xs text-ccb-muted mb-3">This sets your starting rating. You'll climb or fall from here.</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(LEVEL_CONFIG) as ChessLevel[]).map((level) => {
                  const config = LEVEL_CONFIG[level];
                  const selected = chessLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setChessLevel(level)}
                      className={`relative rounded-xl border-2 p-3 text-center transition-all ${
                        selected
                          ? `${config.accent} scale-[1.03]`
                          : "border-ccb-border bg-ccb-surface hover:border-ccb-muted"
                      }`}
                    >
                      <div className="text-2xl mb-1">{config.icon}</div>
                      <div className="text-xs font-bold">{config.label}</div>
                      <div className="text-[10px] text-ccb-muted mt-0.5">{config.rating} ELO</div>
                      {selected && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ccb-primary flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {chessLevel && (
                <p className="text-xs text-ccb-muted mt-2 text-center">{LEVEL_CONFIG[chessLevel].blurb}</p>
              )}
            </div>
          )}

          <button type="submit" disabled={loading || (!chessLevel && !chesscomVerified)} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="text-center text-sm text-ccb-muted mt-6">
          Already have an account?{" "}
          <Link href={loginLink} className="text-ccb-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
