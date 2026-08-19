"use client";

import { useState, useEffect, useCallback } from "react";
import { Cherry, Flame, Share2, MessageCircle, UserPlus, Gamepad2, User, Check, Loader2, Gift, TrendingUp, Copy } from "lucide-react";

interface Props {
  berryBalance: number;
  userId: string;
}

interface RewardTask {
  id: string;
  icon: any;
  title: string;
  desc: string;
  berries: number;
  type: "one-time" | "daily" | "recurring";
  action?: string;
  claimable: boolean;
  claimed?: boolean;
  loading?: boolean;
}

export default function EarnClient({ berryBalance, userId }: Props) {
  const [checkinStatus, setCheckinStatus] = useState({ checkedInToday: false, currentStreak: 0 });
  const [claimedActions, setClaimedActions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [referralStats, setReferralStats] = useState({ total: 0, completed: 0, berriesEarned: 0 });
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<any>({});

  const fetchStatus = useCallback(async () => {
    try {
      const [checkinRes, referralRes] = await Promise.all([
        fetch("/api/berry/daily-checkin"),
        fetch("/api/berry/referral"),
      ]);

      if (checkinRes.ok) {
        const checkinData = await checkinRes.json();
        setCheckinStatus({
          checkedInToday: checkinData.checkedInToday,
          currentStreak: checkinData.currentStreak,
        });
        setConfig(checkinData.config || {});
      }

      if (referralRes.ok) {
        const referralData = await referralRes.json();
        setReferralCode(referralData.referralCode || "");
        setReferralStats(referralData.stats || { total: 0, completed: 0, berriesEarned: 0 });
      }
    } catch {}
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessages({ type, text });
    setTimeout(() => setMessages(null), 4000);
  };

  const handleCheckin = async () => {
    setLoading({ ...loading, checkin: true });
    try {
      const res = await fetch("/api/berry/daily-checkin", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Check-in failed");
      } else {
        showMessage("success", data.message);
        setCheckinStatus({ checkedInToday: true, currentStreak: data.streak });
        window.location.reload();
      }
    } catch {
      showMessage("error", "Check-in failed");
    } finally {
      setLoading({ ...loading, checkin: false });
    }
  };

  const handleClaim = async (action: string) => {
    setLoading({ ...loading, [action]: true });
    try {
      const res = await fetch("/api/berry/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyClaimed) {
          setClaimedActions(new Set([...claimedActions, action]));
        }
        showMessage("error", data.error || "Failed to claim");
      } else {
        showMessage("success", data.message);
        setClaimedActions(new Set([...claimedActions, action]));
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      showMessage("error", "Failed to claim reward");
    } finally {
      setLoading({ ...loading, [action]: false });
    }
  };

  const handleShare = async (platform: "whatsapp" | "copy") => {
    const shareUrl = `https://ccb-github.vercel.app/?ref=${referralCode}`;
    const shareText = `🏆 I'm playing chess on Crazy Chess Battles! Join me and earn CCB berries → ${shareUrl}`;

    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppStatus = async () => {
    const shareUrl = `https://ccb-github.vercel.app/?ref=${referralCode}`;
    const statusText = `🏆 Playing chess on Crazy Chess Battles! Join & earn CCB berries → ${shareUrl}`;
    // Open WhatsApp with pre-filled status text
    window.open(`https://wa.me/?text=${encodeURIComponent(statusText)}`, "_blank");
    // Claim the reward
    await handleClaim("whatsapp_status");
  };

  const tasks: RewardTask[] = [
    {
      id: "daily",
      icon: Flame,
      title: "Daily Check-in",
      desc: `Visit the app every day to earn berries. Current streak: ${checkinStatus.currentStreak} days 🔥`,
      berries: config.berry_daily_login || 5,
      type: "daily",
      claimable: !checkinStatus.checkedInToday,
    },
    {
      id: "share_app",
      icon: Share2,
      title: "Share the App",
      desc: "Share Crazy Chess Battles with your friends on any platform",
      berries: config.berry_share_app || 15,
      type: "one-time",
      action: "share_app",
      claimable: !claimedActions.has("share_app"),
      claimed: claimedActions.has("share_app"),
    },
    {
      id: "whatsapp_status",
      icon: MessageCircle,
      title: "Post WhatsApp Status",
      desc: "Post about CCB on your WhatsApp status and earn berries",
      berries: config.berry_whatsapp_status || 20,
      type: "one-time",
      action: "whatsapp_status",
      claimable: !claimedActions.has("whatsapp_status"),
      claimed: claimedActions.has("whatsapp_status"),
    },
    {
      id: "first_game",
      icon: Gamepad2,
      title: "Play Your First Game",
      desc: "Complete your first ever chess game on CCB",
      berries: config.berry_first_game || 10,
      type: "one-time",
      action: "first_game",
      claimable: !claimedActions.has("first_game"),
      claimed: claimedActions.has("first_game"),
    },
    {
      id: "profile_complete",
      icon: User,
      title: "Complete Your Profile",
      desc: "Add a username, display name, and avatar to your profile",
      berries: config.berry_profile_complete || 5,
      type: "one-time",
      action: "profile_complete",
      claimable: !claimedActions.has("profile_complete"),
      claimed: claimedActions.has("profile_complete"),
    },
  ];

  const streakMilestones = [
    { days: 3, berries: config.berry_streak_3day || 5 },
    { days: 7, berries: config.berry_streak_7day || 10 },
    { days: 14, berries: config.berry_streak_14day || 20 },
    { days: 30, berries: config.berry_streak_30day || 50 },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto pb-20 sm:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Gift className="w-6 h-6 text-red-500" />
          Earn CRAZYCHESSBERRY
        </h1>
        <p className="text-sm text-ccb-muted mt-1">
          Complete tasks to earn CCB 🍒 — trade them on the market or redeem for cash
        </p>
      </div>

      {/* Balance */}
      <div className="card bg-gradient-to-br from-red-500/10 to-ccb-surface border-red-500/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ccb-muted uppercase tracking-wide flex items-center gap-1">
              <Cherry className="w-3 h-3 text-red-500" /> Your CCB Balance
            </p>
            <p className="text-3xl font-bold mt-1">{berryBalance.toLocaleString()} 🍒</p>
          </div>
          <div className="flex gap-2">
            <a href="/berry-market" className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600">
              Market
            </a>
            <a href="/wallet" className="px-3 py-2 rounded-lg bg-ccb-primary text-white text-sm font-medium hover:bg-ccb-primary/90">
              Wallet
            </a>
          </div>
        </div>
      </div>

      {/* Message */}
      {messages && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
          messages.type === "success"
            ? "bg-green-500/10 border border-green-500/30 text-green-600"
            : "bg-red-500/10 border border-red-500/30 text-red-500"
        }`}>
          {messages.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : null}
          {messages.text}
        </div>
      )}

      {/* Daily Check-in */}
      <div className={`card p-4 ${checkinStatus.checkedInToday ? "opacity-60" : "border-ccb-primary/30"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              checkinStatus.checkedInToday ? "bg-green-500/10" : "bg-orange-500/10"
            }`}>
              {checkinStatus.checkedInToday ? (
                <Check className="w-6 h-6 text-green-500" />
              ) : (
                <Flame className="w-6 h-6 text-orange-500" />
              )}
            </div>
            <div>
              <p className="font-medium">Daily Check-in</p>
              <p className="text-xs text-ccb-muted">
                {checkinStatus.checkedInToday
                  ? `Checked in! ${checkinStatus.currentStreak}-day streak 🔥`
                  : `Claim your daily berries — streak: ${checkinStatus.currentStreak} days`}
              </p>
            </div>
          </div>
          {!checkinStatus.checkedInToday && (
            <button
              onClick={handleCheckin}
              disabled={loading.checkin}
              className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading.checkin ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Claim +{config.berry_daily_login || 5} 🍒
            </button>
          )}
        </div>

        {/* Streak progress */}
        {checkinStatus.currentStreak > 0 && (
          <div className="mt-3 pt-3 border-t border-ccb-border">
            <div className="flex items-center gap-2 overflow-x-auto">
              {streakMilestones.map((m) => {
                const reached = checkinStatus.currentStreak >= m.days;
                return (
                  <div
                    key={m.days}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap ${
                      reached ? "bg-orange-500/10 text-orange-500" : "bg-ccb-surface text-ccb-muted"
                    }`}
                  >
                    <Flame className={`w-3 h-3 ${reached ? "text-orange-500" : "text-ccb-muted"}`} />
                    {m.days}d: +{m.berries} 🍒
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* One-time tasks */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-ccb-muted uppercase tracking-wide">One-Time Rewards</h2>
        {tasks.filter(t => t.type === "one-time").map((task) => {
          const Icon = task.icon;
          const isClaimed = task.claimed || claimedActions.has(task.action!);
          return (
            <div key={task.id} className={`card p-4 ${isClaimed ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isClaimed ? "bg-green-500/10" : "bg-red-500/10"
                  }`}>
                    {isClaimed ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Icon className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-ccb-muted">{task.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-red-500">+{task.berries} 🍒</span>
                  {!isClaimed && task.id === "share_app" && (
                    <button
                      onClick={() => handleClaim(task.action!)}
                      disabled={loading[task.action!]}
                      className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                    >
                      {loading[task.action!] ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim"}
                    </button>
                  )}
                  {!isClaimed && task.id === "whatsapp_status" && (
                    <button
                      onClick={handleWhatsAppStatus}
                      disabled={loading[task.action!]}
                      className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                    >
                      {loading[task.action!] ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
                      Post & Claim
                    </button>
                  )}
                  {!isClaimed && task.id !== "share_app" && task.id !== "whatsapp_status" && (
                    <button
                      onClick={() => handleClaim(task.action!)}
                      disabled={loading[task.action!]}
                      className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                    >
                      {loading[task.action!] ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Share buttons */}
      <div className="card p-4">
        <h3 className="font-medium text-sm mb-3 flex items-center gap-1.5">
          <Share2 className="w-4 h-4 text-ccb-primary" />
          Share & Refer Friends
        </h3>
        <p className="text-xs text-ccb-muted mb-3">
          Get {config.berry_referral_signup || 50} CCB for each friend who joins using your referral link!
        </p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => handleShare("whatsapp")}
            className="flex-1 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </button>
          <button
            onClick={() => handleShare("copy")}
            className="flex-1 py-2.5 rounded-lg bg-ccb-surface border border-ccb-border text-sm font-medium hover:border-ccb-primary flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
        <div className="bg-ccb-surface rounded-lg p-2 text-xs text-ccb-muted text-center font-mono">
          {referralCode ? `ccb-github.vercel.app/?ref=${referralCode}` : "Loading..."}
        </div>
        {referralStats.total > 0 && (
          <div className="mt-3 pt-3 border-t border-ccb-border flex justify-between text-xs">
            <span className="text-ccb-muted">
              <UserPlus className="w-3 h-3 inline" /> {referralStats.total} referred ({referralStats.completed} joined)
            </span>
            <span className="font-medium text-red-500">
              +{referralStats.berriesEarned} 🍒 earned from referrals
            </span>
          </div>
        )}
      </div>

      {/* Game rewards info */}
      <div className="card p-4 bg-gradient-to-br from-ccb-primary/5 to-ccb-surface">
        <h3 className="font-medium text-sm mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-ccb-primary" />
          Earn From Playing
        </h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-ccb-muted">Win a quick match</span>
            <span className="font-medium text-red-500">+{config.berry_daily_login ? 10 : 10} 🍒</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ccb-muted">Draw a quick match</span>
            <span className="font-medium text-red-500">+2 🍒</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ccb-muted">3-day login streak</span>
            <span className="font-medium text-red-500">+{config.berry_streak_3day || 5} 🍒 bonus</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ccb-muted">7-day login streak</span>
            <span className="font-medium text-red-500">+{config.berry_streak_7day || 10} 🍒 bonus</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ccb-muted">30-day login streak</span>
            <span className="font-medium text-red-500">+{config.berry_streak_30day || 50} 🍒 bonus</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ccb-muted">Friend joins via referral</span>
            <span className="font-medium text-red-500">+{config.berry_referral_signup || 50} 🍒</span>
          </div>
        </div>
      </div>
    </div>
  );
}
