"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Swords, Trophy, TrendingUp, User, LogOut, Wallet, Shield, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Profile {
  username: string | null;
  display_name: string | null;
  rating: number | null;
  avatar_url: string | null;
  is_admin: boolean | null;
}

export default function AppNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const navItems = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/play", label: "Play", icon: Swords },
    { href: "/tournaments", label: "Tournaments", icon: Trophy },
    { href: "/leaderboard", label: "Rankings", icon: TrendingUp },
    { href: "/history", label: "History", icon: Clock },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    ...(profile?.is_admin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const getRatingTier = (rating: number | null) => {
    if (!rating) return { label: "Unrated", color: "text-ccb-muted" };
    if (rating >= 2200) return { label: "Master", color: "text-purple-400" };
    if (rating >= 1900) return { label: "Diamond", color: "text-cyan-400" };
    if (rating >= 1600) return { label: "Platinum", color: "text-emerald-400" };
    if (rating >= 1300) return { label: "Gold", color: "text-ccb-accent" };
    if (rating >= 1000) return { label: "Silver", color: "text-ccb-silver" };
    return { label: "Bronze", color: "text-ccb-bronze" };
  };

  const tier = getRatingTier(profile?.rating ?? null);

  return (
    <>
      {/* Desktop nav */}
      <nav className="border-b border-ccb-border bg-ccb-surface/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-ccb-primary flex items-center justify-center">
                <span className="text-white font-bold">♞</span>
              </div>
              <span className="font-bold hidden sm:inline">CCB</span>
            </Link>
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-ccb-primary/10 text-ccb-primary"
                        : "text-ccb-muted hover:text-ccb-text hover:bg-ccb-surface"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className={`text-sm font-medium ${tier.color}`}>{tier.label}</span>
              <span className="text-sm font-bold">{profile?.rating ?? "—"}</span>
            </div>
            <Link
              href={profile?.username ? `/profile/${profile.username}` : "/dashboard"}
              className="flex items-center gap-2 text-sm text-ccb-muted hover:text-ccb-text"
            >
              <div className="w-8 h-8 rounded-full bg-ccb-surface border border-ccb-border flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <span className="hidden sm:inline">{profile?.username ?? "Player"}</span>
            </Link>
            <button onClick={handleLogout} className="btn-ghost px-2">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-ccb-border bg-ccb-surface/95 backdrop-blur-md sm:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-4 py-2 ${
                  isActive ? "text-ccb-primary" : "text-ccb-muted"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
