import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: logs, error } = await admin
      .from("admin_logs")
      .select(`
        id, admin_id, action, target_type, target_id, details, created_at,
        profiles!admin_logs_admin_id_fkey(username, display_name)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      // Table might not exist or relationship might differ
      const { data: logsFallback, error: err2 } = await admin
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (err2) return NextResponse.json({ error: err2.message }, { status: 500 });
      return NextResponse.json({ logs: logsFallback || [] });
    }

    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
