import Link from "next/link";
import { Trophy, Swords, TrendingUp, Users, Zap, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-ccb-border bg-ccb-surface/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ccb-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">♞</span>
            </div>
            <span className="font-bold text-lg">Crazy Chess Battles</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost">Log in</Link>
            <Link href="/signup" className="btn-primary">Sign up</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-ccb-border bg-ccb-card px-4 py-1.5 mb-6">
            <Zap className="w-4 h-4 text-ccb-accent" />
            <span className="text-sm text-ccb-muted">Free to play · No downloads</span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6">
            Play. Battle. <span className="text-ccb-primary">Win.</span> Rank.
          </h1>
          <p className="text-lg text-ccb-muted mb-10 max-w-2xl mx-auto">
            Join real-time chess battles. Climb the rankings. Compete in tournaments.
            Prove you&apos;re the best.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary text-base px-8 py-3">
              Start Playing
            </Link>
            <Link href="/leaderboard" className="btn-secondary text-base px-8 py-3">
              View Rankings
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-ccb-border py-20 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <Swords className="w-8 h-8 text-ccb-primary mb-4" />
            <h3 className="font-semibold mb-2">Real-Time Battles</h3>
            <p className="text-sm text-ccb-muted">Play blitz, bullet, or rapid chess against opponents matched to your skill level.</p>
          </div>
          <div className="card">
            <Trophy className="w-8 h-8 text-ccb-accent mb-4" />
            <h3 className="font-semibold mb-2">Tournaments</h3>
            <p className="text-sm text-ccb-muted">Compete in Arena and Swiss tournaments. Win prizes. Build your legacy.</p>
          </div>
          <div className="card">
            <TrendingUp className="w-8 h-8 text-ccb-success mb-4" />
            <h3 className="font-semibold mb-2">Rankings</h3>
            <p className="text-sm text-ccb-muted">Glicko-2 ratings. Climb from Bronze to Master. Track your progress.</p>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-t border-ccb-border py-12 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-ccb-primary">0</div>
            <div className="text-sm text-ccb-muted">Active Players</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-ccb-primary">0</div>
            <div className="text-sm text-ccb-muted">Games Today</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-ccb-primary">0</div>
            <div className="text-sm text-ccb-muted">Live Tournaments</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-ccb-primary">100%</div>
            <div className="text-sm text-ccb-muted">Free to Play</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ccb-border py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-ccb-primary flex items-center justify-center">
              <span className="text-white text-sm">♞</span>
            </div>
            <span className="text-sm text-ccb-muted">© 2026 Crazy Chess Battles</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-ccb-muted">
            <Link href="/login" className="hover:text-ccb-text">Login</Link>
            <Link href="/signup" className="hover:text-ccb-text">Sign Up</Link>
            <Link href="/leaderboard" className="hover:text-ccb-text">Leaderboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
