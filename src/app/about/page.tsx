import Link from "next/link";
import { ArrowRight, Trophy, Zap, Shield, Users, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-ccb-border bg-ccb-surface sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-ccb-primary flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm sm:text-lg">♞</span>
            </div>
            <span className="font-bold text-sm sm:text-lg truncate">Crazy Chess Battles</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/tournaments" className="btn-ghost text-sm hidden sm:inline-flex">Tournaments</Link>
            <Link href="/leaderboard" className="btn-ghost text-sm">Leaderboard</Link>
            <Link href="/signup" className="btn-primary text-sm px-3 sm:px-4">Sign up</Link>
          </div>
        </div>
      </nav>

      {/* Mission */}
      <section className="px-4 py-12 sm:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4">
            Chess is <span className="text-ccb-primary">Africa&apos;s</span> game too
          </h1>
          <p className="text-sm sm:text-lg text-ccb-muted leading-relaxed">
            Crazy Chess Battles was built for one reason: to give Malawian chess players a place to compete,
            earn, and grow — without needing a credit card, a foreign bank account, or a VPN.
          </p>
          <p className="text-sm sm:text-lg text-ccb-muted leading-relaxed mt-4">
            Deposit with TNM Mpamba or Airtel Money. Play opponents at your level. Win tournaments and get paid
            to your phone. Simple as that.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-ccb-border px-4 py-12 sm:py-16 bg-ccb-surface/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg sm:text-xl font-bold text-center mb-8 sm:mb-10">What we stand for</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="card">
              <Zap className="w-6 h-6 text-ccb-primary mb-3" />
              <h3 className="font-semibold mb-2 text-sm">Local-first payments</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">
                Built around mobile money — the way Malawians actually pay. No PayPal, no Stripe, no friction.
              </p>
            </div>
            <div className="card">
              <Trophy className="w-6 h-6 text-ccb-accent mb-3" />
              <h3 className="font-semibold mb-2 text-sm">Real competition</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">
                Glicko-2 ratings, Swiss tournaments, ranked games. Fair matchmaking that respects your skill level.
              </p>
            </div>
            <div className="card">
              <Shield className="w-6 h-6 text-ccb-success mb-3" />
              <h3 className="font-semibold mb-2 text-sm">Transparent economics</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">
                10% platform fee, 40% to tournament creators, 50% to the prize pool. Every kwacha is accounted for.
              </p>
            </div>
            <div className="card">
              <Users className="w-6 h-6 text-ccb-primary mb-3" />
              <h3 className="font-semibold mb-2 text-sm">Community-owned</h3>
              <p className="text-xs sm:text-sm text-ccb-muted">
                Players can create their own tournaments, earn from organizing, and build their own chess communities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Story */}
      <section className="border-t border-ccb-border px-4 py-12 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg sm:text-xl font-bold mb-6">The story</h2>
          <div className="space-y-4 text-sm text-ccb-muted leading-relaxed">
            <p>
              CCB started with a simple frustration: Malawian chess players had no local platform to compete on.
              Chess.com was great, but you couldn&apos;t deposit with mobile money or play in tournaments with
              prizes that made sense locally.
            </p>
            <p>
              So we built one. A platform where you can deposit MK 1,000 from your phone, enter a blitz tournament,
              win, and get paid back to your phone — all without leaving WhatsApp.
            </p>
            <p>
              Today, CCB runs on the crazychessbattles.live domain, supports TNM and Airtel Money, and gives
              players the tools to not just compete, but to organize and earn from the game they love.
            </p>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="border-t border-ccb-border px-4 py-12 sm:py-16 bg-ccb-primary/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-lg sm:text-xl font-bold mb-8">By the numbers</h2>
          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-ccb-primary">2+</div>
              <div className="text-xs sm:text-sm text-ccb-muted mt-1">Mobile money operators</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-ccb-accent">4</div>
              <div className="text-xs sm:text-sm text-ccb-muted mt-1">Time controls</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-ccb-success">10%</div>
              <div className="text-xs sm:text-sm text-ccb-muted mt-1">Platform fee (lowest around)</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-ccb-border py-12 sm:py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Heart className="w-8 h-8 text-ccb-accent mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold mb-3">Join the community</h2>
          <p className="text-sm text-ccb-muted mb-6">
            Whether you&apos;re a casual player or a tournament organizer, there&apos;s a place for you at CCB.
          </p>
          <Link href="/signup" className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
            Create Free Account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ccb-border py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row-reverse items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-ccb-primary flex items-center justify-center shrink-0">
              <span className="text-white text-sm">♞</span>
            </div>
            <span className="text-xs sm:text-sm text-ccb-muted">© 2026 Crazy Chess Battles</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-ccb-muted flex-wrap justify-center">
            <Link href="/" className="hover:text-ccb-text transition-colors">Home</Link>
            <Link href="/how-it-works" className="hover:text-ccb-text transition-colors">How it Works</Link>
            <Link href="/leaderboard" className="hover:text-ccb-text transition-colors">Leaderboard</Link>
            <Link href="/tournaments" className="hover:text-ccb-text transition-colors">Tournaments</Link>
            <Link href="/faq" className="hover:text-ccb-text transition-colors">FAQ</Link>
            <Link href="/terms" className="hover:text-ccb-text transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-ccb-text transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
