import Link from "next/link";
import { Trophy, Swords, TrendingUp, Zap, Wallet, Crown, ArrowRight, Check } from "lucide-react";
import HomeStats from "./home-stats";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-ccb-border bg-ccb-surface sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-ccb-primary flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm sm:text-lg">♞</span>
            </div>
            <span className="font-bold text-sm sm:text-lg truncate">Crazy Chess Battles</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/login" className="btn-ghost text-sm">Log in</Link>
            <Link href="/signup" className="btn-primary text-sm px-3 sm:px-4">Sign up</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
        <div className="max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-ccb-border bg-ccb-card px-3 sm:px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-ccb-accent shrink-0" />
            <span className="text-xs sm:text-sm text-ccb-muted">Tournaments · Prizes · Rankings</span>
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-4 sm:mb-6 leading-tight">
            Compete. Win. <span className="text-ccb-primary">Dominate.</span>
          </h1>
          <p className="text-base sm:text-lg text-ccb-muted mb-8 sm:mb-10 max-w-2xl mx-auto px-2">
            Malawi&apos;s competitive chess arena. Enter paid tournaments, climb the rankings, and claim your prize.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
            <Link href="/signup" className="btn-primary text-base px-8 py-3 w-full sm:w-auto">
              Start Playing
            </Link>
            <Link href="/leaderboard" className="btn-secondary text-base px-8 py-3 w-full sm:w-auto">
              View Rankings
            </Link>
          </div>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 mt-8 sm:mt-10 text-xs sm:text-sm text-ccb-muted flex-wrap">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-ccb-success" />
              <span>TNM & Airtel Money</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-ccb-success" />
              <span>Instant payouts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-ccb-success" />
              <span>Glicko-2 ratings</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="border-t border-ccb-border py-8 sm:py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <HomeStats />
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-ccb-border py-12 sm:py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-8 sm:mb-10">Why CCB?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="card card-hover">
              <Swords className="w-7 h-7 sm:w-8 sm:h-8 text-ccb-primary mb-3 sm:mb-4" />
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Real-Time Battles</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">Blitz, bullet, or rapid chess against opponents matched to your skill level.</p>
            </div>
            <div className="card card-hover">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-ccb-accent mb-3 sm:mb-4" />
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Paid Tournaments</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">Enter Swiss tournaments with real prize pools. Win and get paid instantly to your wallet.</p>
            </div>
            <div className="card card-hover">
              <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-ccb-success mb-3 sm:mb-4" />
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Rankings</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">Glicko-2 ratings. Climb from Bronze to Master. Track every win.</p>
            </div>
            <div className="card card-hover">
              <Wallet className="w-7 h-7 sm:w-8 sm:h-8 text-ccb-primary mb-3 sm:mb-4" />
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Wallet & Deposits</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">Deposit via TNM Mpamba or Airtel Money. Entry fees and prize payouts handled in-app.</p>
            </div>
            <div className="card card-hover">
              <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-ccb-accent mb-3 sm:mb-4" />
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Seasons</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">Compete across seasonal championships. Qualify through consistent play.</p>
            </div>
            <div className="card card-hover">
              <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-ccb-success mb-3 sm:mb-4" />
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Challenge Friends</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">Generate a link and play with friends. Ranked or casual — your choice.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-ccb-border py-12 sm:py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-3xl font-bold mb-3 sm:mb-4">Ready to battle?</h2>
          <p className="text-sm sm:text-base text-ccb-muted mb-6 sm:mb-8">
            Create your free account. Deposit with mobile money. Start winning prizes.
          </p>
          <Link href="/signup" className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ccb-border py-6 sm:py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row-reverse items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-ccb-primary flex items-center justify-center shrink-0">
              <span className="text-white text-sm">♞</span>
            </div>
            <span className="text-xs sm:text-sm text-ccb-muted">© 2026 Crazy Chess Battles</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-ccb-muted flex-wrap justify-center">
            <Link href="/login" className="hover:text-ccb-text transition-colors">Login</Link>
            <Link href="/signup" className="hover:text-ccb-text transition-colors">Sign Up</Link>
            <Link href="/leaderboard" className="hover:text-ccb-text transition-colors">Leaderboard</Link>
            <Link href="/tournaments" className="hover:text-ccb-text transition-colors">Tournaments</Link>
            <Link href="/terms" className="hover:text-ccb-text transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-ccb-text transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
