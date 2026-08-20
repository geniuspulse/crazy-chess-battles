"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Capture redirect path from URL
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  // Capture referral code from URL or localStorage
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chessLevel) {
      setError("Please select your chess level");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username,
          chess_level: chessLevel,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Set initial ELO
    if (data?.user?.id) {
      try {
        await fetch("/api/auth/set-rating", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.user.id }),
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
      } catch {
        // Non-critical
      }
    }

    router.push(redirectPath);
    router.refresh();
  };

  // Build login link with redirect param preserved
  const loginLink = redirectPath !== "/dashboard"
    ? `/login?redirect=${encodeURIComponent(redirectPath)}`
    : "/login";

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

          {/* Chess Level Selector */}
          <div>
            <label className="text-sm font-medium block mb-2">Your Chess Level</label>
            <p className="text-xs text-ccb-muted mb-3">This sets your starting rating. You'll climb or fall from here, just like chess.com.</p>
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

          <button type="submit" disabled={loading || !chessLevel} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
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
