import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { timeControl, rated } = await req.json();

    // Get player profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, rating")
      .eq("id", user.id)
      .single();

    // Get admin users
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from("profiles")
      .select("email, username, display_name")
      .eq("is_admin", true)
      .limit(5);

    if (!admins || admins.length === 0) {
      return NextResponse.json({ success: true, notified: false });
    }

    const playerName = profile?.display_name || profile?.username || "Unknown";
    const playerRating = profile?.rating ?? "unknown";
    const tcLabel = timeControl || "unknown";
    const gameType = rated ? "Ranked" : "Casual";

    // Try storing a notification in the DB (table may not exist yet)
    for (const adminUser of admins) {
      try {
        await admin.from("admin_notifications").insert({
          type: "matchmaking_fallback",
          title: "Player needs an opponent",
          message: `${playerName} (rating ${playerRating}) is looking for a ${tcLabel} ${gameType} game. No opponents were available in the queue.`,
          player_id: user.id,
          player_name: playerName,
          time_control: tcLabel,
          rated: rated ?? true,
          read: false,
        });
      } catch {}
    }

    // Try sending via Resend if configured
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const adminEmails = admins.map((a: any) => a.email).filter(Boolean);
      if (adminEmails.length > 0) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "CCB Alerts <alerts@ccb-github.vercel.app>",
              to: adminEmails,
              subject: `♟️ Player waiting: ${playerName} needs an opponent`,
              html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0f;color:#e2e8f0;padding:24px;border-radius:12px;border:1px solid #2a2a3a"><div style="text-align:center;margin-bottom:20px"><span style="font-size:32px">♟️</span><h2 style="color:#7c3aed;margin:8px 0">Player needs an opponent</h2></div><p style="font-size:14px;color:#9ca3af">A player couldn't find a Quick Match and may still be waiting:</p><table style="width:100%;font-size:14px;margin:16px 0"><tr><td style="color:#9ca3af;padding:4px 0">Player</td><td style="color:#fff;font-weight:600">${playerName}</td></tr><tr><td style="color:#9ca3af;padding:4px 0">Rating</td><td style="color:#fff">${playerRating}</td></tr><tr><td style="color:#9ca3af;padding:4px 0">Time Control</td><td style="color:#fff">${tcLabel}</td></tr><tr><td style="color:#9ca3af;padding:4px 0">Type</td><td style="color:#fff">${gameType}</td></tr></table><p style="font-size:13px;color:#9ca3af;margin-top:20px">Log in to CCB and join the matchmaking queue to play with them.</p><div style="text-align:center;margin-top:16px"><a href="https://ccb-github.vercel.app/play" style="background:#7c3aed;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open CCB</a></div></div>`,
            }),
          });
        } catch {}
      }
    }

    return NextResponse.json({ success: true, notified: true, adminCount: admins.length });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Failed to notify admin" },
      { status: 500 }
    );
  }
}
