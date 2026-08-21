import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { timeControl, rated } = await req.json();
    const admin = createAdminClient();

    // Get the user's referral code to append to the challenge link
    const { data: profile } = await admin
      .from("profiles")
      .select("referral_code, username")
      .eq("id", user.id)
      .single();

    const referralCode = profile?.referral_code || profile?.username || null;

    // Generate a simple challenge link — we use a token in the URL
    // The challenge link is just a game invite with pre-set settings
    const token = crypto.randomUUID();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://crazychessbattles.live";
    
    // Build URL with optional referral code
    const params = new URLSearchParams();
    if (timeControl) params.set("tc", timeControl);
    params.set("rated", rated ? "1" : "0");
    if (referralCode) params.set("ref", referralCode);
    
    const url = `${baseUrl}/play?${params.toString()}`;

    return NextResponse.json({ url, referralCode });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
