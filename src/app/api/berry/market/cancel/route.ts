import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { listingId } = await req.json();
    if (!listingId) {
      return NextResponse.json({ error: "Listing ID required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get listing
    const { data: listing } = await admin
      .from("berry_market_listings")
      .select("id, seller_id, amount, filled_amount, status")
      .eq("id", listingId)
      .single();

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.seller_id !== user.id) {
      return NextResponse.json({ error: "Not your listing" }, { status: 403 });
    }

    if (listing.status !== "active" && listing.status !== "partial") {
      return NextResponse.json({ error: "Listing is not active" }, { status: 400 });
    }

    // Calculate remaining berries to refund
    const remaining = listing.amount - listing.filled_amount;

    // Cancel listing
    await admin
      .from("berry_market_listings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", listingId);

    // Refund remaining berries to seller
    if (remaining > 0) {
      await admin.rpc("credit_berries", {
        p_user_id: user.id,
        p_amount: remaining,
        p_description: `Cancelled market listing — refund of ${remaining} CCB`,
      });
    }

    return NextResponse.json({
      success: true,
      refunded: remaining,
      message: `Listing cancelled. ${remaining} CCB refunded to your account.`,
    });
  } catch (e: any) {
    console.error("Berry market cancel error:", e);
    return NextResponse.json({ error: e.message || "Cancel failed" }, { status: 500 });
  }
}
