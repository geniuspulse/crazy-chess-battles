import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — list all users
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: users, error } = await admin
      .from("profiles")
      .select("id, username, display_name, email, rating, games_played, wins, losses, draws, wallet_balance_cents, is_admin, is_banned, phone, berry_balance, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// PATCH — manage a user (ban/unban, toggle admin, adjust rating, adjust wallet, grant berries)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { userId, action, value } = body;

    if (!userId || !action) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const updates: Record<string, unknown> = {};

    switch (action) {
      case "ban":
        updates.is_banned = true;
        break;
      case "unban":
        updates.is_banned = false;
        break;
      case "toggle_admin":
        updates.is_admin = !!value;
        break;
      case "adjust_rating":
        if (typeof value !== "number" || value < 0 || value > 4000)
          return NextResponse.json({ error: "Rating must be 0-4000" }, { status: 400 });
        updates.rating = value;
        break;
      case "adjust_wallet":
        if (typeof value !== "number")
          return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        if (value > 0) {
          const { error } = await admin.rpc("credit_wallet", {
            p_user_id: userId,
            p_amount_cents: value,
          });
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        } else if (value < 0) {
          const { error } = await admin.rpc("debit_wallet", {
            p_user_id: userId,
            p_amount_cents: Math.abs(value),
          });
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }
        break;
      case "grant_berries":
        if (typeof value !== "number" || value <= 0)
          return NextResponse.json({ error: "Invalid berry amount" }, { status: 400 });
        const { error: berryErr } = await admin.rpc("credit_berries", {
          p_user_id: userId,
          p_amount: value,
          p_description: "Admin grant",
        });
        if (berryErr) return NextResponse.json({ error: berryErr.message }, { status: 500 });
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Apply profile updates if any
    if (Object.keys(updates).length > 0) {
      const { error } = await admin.from("profiles").update(updates).eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the action
    try {
      await admin.from("admin_logs").insert({
        admin_id: user.id,
        action: `user_${action}`,
        target_type: "user",
        target_id: userId,
        details: { value },
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
