import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { listingId, amount } = await req.json();
    if (!listingId) {
      return NextResponse.json({ error: "Listing ID required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Execute trade via SQL function (atomic)
    const { data: result, error } = await admin.rpc("execute_berry_trade", {
      p_listing_id: listingId,
      p_buyer_id: user.id,
      p_buy_amount: amount || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // result is a JSONB object
    if (result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (!result || !result.success) {
      return NextResponse.json({ error: "Trade failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bought: result.amount,
      paidCents: result.price_cents,
      paidFormatted: `MWK ${Math.floor(result.price_cents / 100).toLocaleString()}`,
      buyerWalletBalance: result.buyer_balance,
      buyerBerryBalance: result.buyer_berries,
    });
  } catch (e: any) {
    console.error("Berry market buy error:", e);
    return NextResponse.json({ error: e.message || "Purchase failed" }, { status: 500 });
  }
}
