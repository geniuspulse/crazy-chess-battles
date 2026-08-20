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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chessLevel) {
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
            chessLevel,
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
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="Pick your username"
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

          <button
            type="submit"
            disabled={loading || !chessLevel}
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
