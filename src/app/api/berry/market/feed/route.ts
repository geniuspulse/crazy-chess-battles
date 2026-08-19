import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const sort = searchParams.get("sort") || "price"; // "price" = cheapest first, "newest" = latest

    let query = admin
      .from("berry_market_listings")
      .select(`
        id, amount, price_cents, filled_amount, status, created_at,
        seller:profiles!seller_id(username, display_name, avatar_url)
      `)
      .in("status", ["active", "partial"])
      .limit(Math.min(limit, 50));

    if (sort === "price") {
      // Cheapest per-berry first
      query = query.order("price_cents", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data: listings, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add unit price and remaining
    const enriched = (listings || []).map((l: any) => {
      const remaining = l.amount - (l.filled_amount || 0);
      return {
        ...l,
        remaining,
        unit_price_cents: Math.round(l.price_cents / l.amount),
        unit_price_formatted: `MWK ${(l.price_cents / l.amount / 100).toFixed(1)}`,
        total_price_formatted: `MWK ${Math.floor(l.price_cents / 100).toLocaleString()}`,
        seller_name: l.seller?.display_name || l.seller?.username || "Unknown",
      };
    });

    return NextResponse.json({ listings: enriched });
  } catch (e: any) {
    console.error("Berry market feed error:", e);
    return NextResponse.json({ error: "Failed to load market" }, { status: 500 });
  }
}
