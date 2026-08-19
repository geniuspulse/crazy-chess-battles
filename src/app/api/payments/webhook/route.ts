import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// PayChangu signs webhooks with HMAC-SHA256 of the raw JSON body, using the
// webhook secret from the dashboard. The digest is sent in the "Signature" header.
// See: https://developer.paychangu.com/docs/webhooks
function isValidSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    // Read the raw body first — HMAC must be computed over the exact bytes PayChangu sent.
    const rawBody = await req.text();

    const webhookSecret = process.env.PAYCHANGU_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("PAYCHANGU_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    const signature = req.headers.get("signature") || req.headers.get("Signature");
    if (!isValidSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    const status = body.status;
    const chargeId = body.charge_id;

    if (!chargeId) {
      return NextResponse.json({ error: "No charge_id" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch the deposit (charge_id for mobile money, tx_ref for card/standard checkout)
    let { data: deposit } = await admin
      .from("deposits")
      .select("id, user_id, amount_cents, status")
      .eq("charge_id", chargeId)
      .single();

    if (!deposit) {
      const { data: txDeposit } = await admin
        .from("deposits")
        .select("id, user_id, amount_cents, status")
        .eq("tx_ref", chargeId)
        .single();
      deposit = txDeposit;
    }

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

      // Trigger referral activation for wallet top-up
      await admin.rpc("check_referral_activation", { p_user_id: deposit.user_id, p_action: "wallet_topup" });
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
