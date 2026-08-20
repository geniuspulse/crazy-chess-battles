import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action } = await req.json();
    if (!action) return NextResponse.json({ error: "Action required" }, { status: 400 });

    const admin = createAdminClient();

    // Get config
    const { data: config } = await admin.from("berry_config").select("*").limit(1).single();
    if (!config?.enabled) {
      return NextResponse.json({ error: "Berry earning is disabled" }, { status: 400 });
    }

    // Map action to config field
    const actionMap: Record<string, { configKey: string; description: string }> = {
      share_app: { configKey: "berry_share_app", description: "Shared the app!" },
      whatsapp_status: { configKey: "berry_whatsapp_status", description: "Posted WhatsApp status about CCB!" },
      first_game: { configKey: "berry_first_game", description: "Played your first game!" },
      profile_complete: { configKey: "berry_profile_complete", description: "Completed your profile!" },
    };

    const actionInfo = actionMap[action];
    if (!actionInfo) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Check if already claimed (one-time rewards)
    const { data: existing } = await admin
      .from("engagement_log")
      .select("id")
      .eq("user_id", user.id)
      .eq("action", action)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Reward already claimed", alreadyClaimed: true }, { status: 400 });
    }

    // Server-side verification for actions that claim a real achievement —
    // prevents berry farming by clicking Claim without actually doing the thing.
    if (action === "first_game") {
      const { count } = await admin
        .from("games")
        .select("id", { count: "exact", head: true })
        .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
        .not("status", "eq", "playing");

      if (!count || count < 1) {
        return NextResponse.json(
          { error: "Play and finish at least one game first" },
          { status: 400 }
        );
      }
    }

    if (action === "profile_complete") {
      const { data: profile } = await admin
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (!profile?.username || !profile?.display_name || !profile?.avatar_url) {
        return NextResponse.json(
          { error: "Add a username, display name, and avatar to your profile first" },
          { status: 400 }
        );
      }
    }

    const berries = (config as any)[actionInfo.configKey] || 0;
    if (berries <= 0) {
      return NextResponse.json({ error: "This reward is not available" }, { status: 400 });
    }

    // Log the engagement action
    await admin.from("engagement_log").insert({
      user_id: user.id,
      action,
      berries_awarded: berries,
    });

    // Update berry_transaction type constraint won't include these yet in existing DB
    // Use credit_berries which logs as 'earned'
    await admin.rpc("credit_berries", {
      p_user_id: user.id,
      p_amount: berries,
      p_description: actionInfo.description,
    });

    return NextResponse.json({
      success: true,
      berriesAwarded: berries,
      action,
      message: `+${berries} CCB! ${actionInfo.description}`,
    });
  } catch (e: any) {
    console.error("Berry engagement error:", e);
    return NextResponse.json({ error: e.message || "Failed to claim reward" }, { status: 500 });
  }
}
