import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creates a referral record when a new user signs up with a referral code.
 * Called from the signup page after successful auth.
 */
export async function POST(req: NextRequest) {
  try {
    const { referralCode, referredId } = await req.json();
    
    if (!referralCode || !referredId) {
      return NextResponse.json({ error: "Missing referral code or user ID" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Find the referrer by their referral code
    const { data: referrer } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", referralCode)
      .single();

    if (!referrer) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
    }

    // Don't allow self-referral
    if (referrer.id === referredId) {
      return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
    }

    // Check if this referred user already has a referral record
    const { data: existing } = await admin
      .from("referrals")
      .select("id")
      .eq("referred_id", referredId)
      .single();

    if (existing) {
      return NextResponse.json({ alreadyReferred: true });
    }

    // Create the referral record (status: pending — will be activated when conditions are met)
    const { error } = await admin
      .from("referrals")
      .insert({
        referrer_id: referrer.id,
        referred_id: referredId,
        referral_code: referralCode,
        status: "pending",
      });

    if (error) {
      console.error("Referral creation error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Referral tracked!" });
  } catch (e: any) {
    console.error("Referral track error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
