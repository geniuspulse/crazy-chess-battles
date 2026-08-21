import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing user ID" }, { status: 400 });

    const admin = createAdminClient();

    // Check if user already received a welcome bonus
    const { data: existing } = await admin
      .from("berry_transactions")
      .select("id")
      .eq("user_id", userId)
      .ilike("description", "Welcome bonus%")
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ alreadyAwarded: true });
    }

    // Award 500 berries as welcome bonus
    const { error } = await admin.rpc("credit_berries", {
      p_user_id: userId,
      p_amount: 500,
      p_game_id: null,
      p_description: "Welcome bonus! Thanks for joining Crazy Chess Battles",
    });

    if (error) {
      console.error("Welcome bonus error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, berries: 500 });
  } catch (e: any) {
    console.error("Welcome bonus error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
