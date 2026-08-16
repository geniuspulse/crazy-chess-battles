import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify webhook authenticity via shared secret
    const webhookSecret = req.headers.get("x-paychangu-secret");
    if (process.env.PAYCHANGU_WEBHOOK_SECRET && webhookSecret !== process.env.PAYCHANGU_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

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
      // Credit wallet atomically (RPC avoids read-then-write race)
      await admin.rpc("credit_wallet", {
        p_user_id: deposit.user_id,
        p_amount_cents: deposit.amount_cents,
      });

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
