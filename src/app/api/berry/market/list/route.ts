import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { amount, priceCents } = await req.json();

    if (!amount || amount < 10) {
      return NextResponse.json({ error: "Minimum 10 berries per listing" }, { status: 400 });
    }
    if (!priceCents || priceCents < 100) {
      return NextResponse.json({ error: "Minimum price is MWK 1" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check seller has enough berries
    const { data: profile } = await admin
      .from("profiles")
      .select("berry_balance, username")
      .eq("id", user.id)
      .single();

    if (!profile || profile.berry_balance < amount) {
      return NextResponse.json({ error: `Insufficient berries. You have ${profile?.berry_balance ?? 0}.` }, { status: 400 });
    }

    // Lock berries by debiting them immediately (prevents double-spending)
    await admin.rpc("debit_berries", {
      p_user_id: user.id,
      p_amount: amount,
      p_description: `Listed ${amount} CCB on market for MWK ${(priceCents / 100).toLocaleString()}`,
    });

    // Create listing
    const { data: listing, error } = await admin
      .from("berry_market_listings")
      .insert({
        seller_id: user.id,
        amount,
        price_cents: priceCents,
        status: "active",
      })
      .select("id, amount, price_cents, created_at")
      .single();

    if (error) {
      // Refund berries if listing creation failed
      await admin.rpc("credit_berries", {
        p_user_id: user.id,
        p_amount: amount,
        p_description: "Refund: listing creation failed",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      listing,
      message: `Listed ${amount} CCB for MWK ${(priceCents / 100).toLocaleString()}`,
    });
  } catch (e: any) {
    console.error("Berry market list error:", e);
    return NextResponse.json({ error: e.message || "Failed to create listing" }, { status: 500 });
  }
}
