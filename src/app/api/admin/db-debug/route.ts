import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint to diagnose DATABASE_URL connection issues.
 * Protected by CRON_SECRET. Does NOT expose the password.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
    }

    // Parse the URL safely without exposing the password
    let parsed: URL;
    try {
      parsed = new URL(dbUrl);
    } catch {
      return NextResponse.json({ error: "DATABASE_URL is not a valid URL" });
    }

    const safeInfo = {
      protocol: parsed.protocol,
      username: parsed.username,
      hostname: parsed.hostname,
      port: parsed.port,
      database: parsed.pathname.replace("/", ""),
      passwordLength: parsed.password?.length || 0,
      hasPassword: !!parsed.password,
      // Try to connect and report the actual error
    };

    // Try connecting
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: dbUrl });
      await client.connect();
      const res = await client.query("SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'");
      await client.end();
      return NextResponse.json({
        ...safeInfo,
        connected: true,
        publicTables: res.rows[0].table_count,
      });
    } catch (connErr: any) {
      return NextResponse.json({
        ...safeInfo,
        connected: false,
        connError: connErr.message,
        connCode: connErr.code,
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
