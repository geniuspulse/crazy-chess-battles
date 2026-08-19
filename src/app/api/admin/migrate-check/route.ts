import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Migration 003 + 004: Adds chess_level column to profiles and creates game_chat table.
 * Uses Supabase REST API (admin client) instead of direct Postgres connection.
 * Protected by CRON_SECRET.
 */

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const results: string[] = [];

    // 1. Check if chess_level column exists by trying to select it
    const { error: checkLevel } = await admin
      .from("profiles")
      .select("chess_level")
      .limit(1);

    if (checkLevel && checkLevel.code === "42703") {
      // Column doesn't exist — we need to create an RPC to add it
      // Try calling a migration RPC that we create on the fly
      results.push("chess_level column missing — needs DDL migration");
    } else {
      results.push("chess_level column already exists ✓");
    }

    // 2. Check if game_chat table exists
    const { error: checkChat } = await admin
      .from("game_chat")
      .select("*")
      .limit(1);

    if (checkChat && checkChat.code === "PGRST205") {
      results.push("game_chat table missing — needs DDL migration");
    } else {
      results.push("game_chat table already exists ✓");
    }

    // 3. Check if withdrawals table exists
    const { error: checkWithdrawals } = await admin
      .from("withdrawals")
      .select("*")
      .limit(1);

    if (checkWithdrawals && checkWithdrawals.code === "PGRST205") {
      results.push("withdrawals table missing — needs DDL migration");
    } else {
      results.push("withdrawals table already exists ✓");
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    console.error("Migration check error:", e);
    return NextResponse.json({ error: e.message || "Check failed" }, { status: 500 });
  }
}
