"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, LogOut, Save, ChevronRight, Trophy, Swords, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  rating: number | null;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  tournaments_played: number | null;
  tournaments_won: number | null;
  wallet_balance_cents: number | null;
  is_admin: boolean | null;
}

export default function SettingsClient({ profile, userId }: { profile: Profile | null; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio, phone })
      .eq("id", userId);
    if (error) {
      setError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const walletBalance = profile?.wallet_balance_cents
    ? `MK ${Math.floor(profile.wallet_balance_cents / 100).toLocaleString("en-US")}`
    : "MK 0";

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-6 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>

      {/* Profile section */}
      <div className="card p-4 space-y-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <User className="w-4 h-4 text-ccb-primary" />
          Profile
        </h3>

        <div>
          <label className="text-sm font-medium block mb-1.5">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            placeholder="Your name"
            maxLength={30}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input min-h-[80px] resize-none"
            placeholder="Tell players about yourself"
            maxLength={200}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Phone (for withdrawals)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            placeholder="+265 991 23 45 67"
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save className="w-4 h-4 mr-1" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {saved && <span className="text-sm text-ccb-success">Saved!</span>}
          {error && <span className="text-sm text-ccb-danger">{error}</span>}
        </div>
      </div>

      {/* Account overview */}
      <div className="card p-4">
        <h3 className="font-bold text-base mb-3">Account</h3>
        <div className="space-y-3">
          <Link href={profile?.username ? `/profile/${profile.username}` : "/dashboard"} className="flex items-center justify-between hover:bg-ccb-surface -mx-2 px-2 py-2 rounded-lg transition-colors">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-4 h-4 text-ccb-accent" />
              <span className="text-sm">Public Profile</span>
            </div>
            <ChevronRight className="w-4 h-4 text-ccb-muted" />
          </Link>
          <Link href="/wallet" className="flex items-center justify-between hover:bg-ccb-surface -mx-2 px-2 py-2 rounded-lg transition-colors">
            <div className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4 text-ccb-accent" />
              <span className="text-sm">Wallet · {walletBalance}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-ccb-muted" />
          </Link>
          <Link href="/history" className="flex items-center justify-between hover:bg-ccb-surface -mx-2 px-2 py-2 rounded-lg transition-colors">
            <div className="flex items-center gap-2.5">
              <Swords className="w-4 h-4 text-ccb-text" />
              <span className="text-sm">Game History</span>
            </div>
            <ChevronRight className="w-4 h-4 text-ccb-muted" />
          </Link>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-ccb-danger/10 border border-ccb-danger/30 text-ccb-danger px-4 py-3 text-sm font-medium hover:bg-ccb-danger/20 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Log out
      </button>
    </div>
  );
}
