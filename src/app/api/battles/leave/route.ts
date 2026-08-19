import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Leave a Battle queue — refunds the locked stake.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    // Find the player's waiting queue entry
    const { data: queueEntry } = await admin
      .from("battle_queue")
      .select("id, stake_cents")
      .eq("player_id", user.id)
      .eq("status", "waiting")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!queueEntry) {
      return NextResponse.json({ error: "Not in any battle queue" }, { status: 400 });
    }

    // Refund the locked stake
    const { error: creditErr } = await admin.rpc("credit_wallet", {
      p_user_id: user.id,
      p_amount_cents: queueEntry.stake_cents,
    });

    if (creditErr) {
      console.error("Refund failed:", creditErr);
      return NextResponse.json({ error: "Failed to refund stake" }, { status: 500 });
    }

    // Record refund
    await admin.from("deposits").insert({
      user_id: user.id,
      amount_cents: queueEntry.stake_cents,
      status: "success",
      method: "battle_refund",
      reference: `battle_queue_refund:${queueEntry.id}`,
    });

    // Mark queue entry as left
    await admin
      .from("battle_queue")
      .update({ status: "left" })
      .eq("id", queueEntry.id);

    return NextResponse.json({ success: true, refunded: queueEntry.stake_cents });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to leave queue" }, { status: 500 });
  }
}
