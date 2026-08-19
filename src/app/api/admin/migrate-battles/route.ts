import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One-time migration route: creates Chess Battles tables.
 * Protected by admin auth + CRON_SECRET.
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    // Run SQL via pg
    const { Client } = await import("pg");
    const fs = await import("fs");
    const path = await import("path");

    const sqlPath = path.join(process.cwd(), "supabase/migrations/005_chess_battles.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(sql);

    // Verify tables exist
    const res = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'battle%'"
    );
    await client.end();

    return NextResponse.json({
      success: true,
      tables: res.rows.map((r: { tablename: string }) => r.tablename),
    });
  } catch (e: any) {
    console.error("Migration error:", e);
    return NextResponse.json({ error: e.message || "Migration failed" }, { status: 500 });
  }
}

// Helper to avoid circular import
async function createClient() {
  const { createClient: createSupaClient } = await import("@/lib/supabase/server");
  return createSupaClient();
}
