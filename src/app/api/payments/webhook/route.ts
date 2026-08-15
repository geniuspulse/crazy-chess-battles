import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify this is a legitimate Paychangu webhook
    // In production, you should verify the signature or secret hash
    const eventType = body.event_type;
    const status = body.status;
    const chargeId = body.charge_id;

    if (!chargeId) {
      return NextResponse.json({ error: "No charge_id" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch the deposit
    const { data: deposit } = await admin
      .from("deposits")
      .select("id, user_id, amount_cents, status")
      .eq("charge_id", chargeId)
      .single();

    if (!deposit) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    // Only process if still pending
    if (deposit.status !== "pending") {
      return NextResponse.json({ received: true, message: "Already processed" });
    }

    if (status === "success") {
      // Credit wallet
      const { data: profile } = await admin
        .from("profiles")
        .select("wallet_balance_cents")
        .eq("id", deposit.user_id)
        .single();

      const newBalance = (profile?.wallet_balance_cents || 0) + deposit.amount_cents;

      await admin
        .from("profiles")
        .update({ wallet_balance_cents: newBalance })
        .eq("id", deposit.user_id);

      await admin
        .from("deposits")
        .update({ status: "success", updated_at: new Date().toISOString() })
        .eq("id", deposit.id);
    } else if (status === "failed" || status === "cancelled") {
      await admin
        .from("deposits")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", deposit.id);
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
