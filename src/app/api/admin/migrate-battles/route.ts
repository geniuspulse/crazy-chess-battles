import { NextRequest, NextResponse } from "next/server";

/**
 * One-time migration: creates Chess Battles tables.
 * Protected by CRON_SECRET (callable without user auth).
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Run SQL via pg
    const { Client } = await import("pg");
    const fs = await import("fs");
    const path = await import("path");

    const sqlPath = path.join(process.cwd(), "supabase/migrations/005_chess_battles.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
    }

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
