import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { amountCents, phone, operatorRefId, email, firstName, lastName } = await req.json();

    if (!amountCents || amountCents < 1000) {
      return NextResponse.json({ error: "Minimum deposit is MWK 10" }, { status: 400 });
    }
    if (!phone || !operatorRefId) {
      return NextResponse.json({ error: "Phone number and operator required" }, { status: 400 });
    }

    const chargeId = `ccb_${Date.now()}_${user.id.slice(0, 8)}`;
    const admin = createAdminClient();

    const { data: deposit, error: depositError } = await admin
      .from("deposits")
      .insert({
        user_id: user.id,
        amount_cents: amountCents,
        method: "mobile_money",
        status: "pending",
        charge_id: chargeId,
        phone,
        operator: operatorRefId,
      })
      .select("id")
      .single();

    if (depositError || !deposit) {
      return NextResponse.json({ error: "Failed to create deposit record" }, { status: 500 });
    }

    const amount = Math.floor(amountCents / 100).toString();
    const res = await fetch("https://api.paychangu.com/mobile-money/payments/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mobile: phone,
        mobile_money_operator_ref_id: operatorRefId,
        amount,
        charge_id: chargeId,
        email: email || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error || data.status === "failed") {
      await admin.from("deposits")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", deposit.id);

      // Never leak raw API error — use safe messages only
      const safeError = data.status === "failed"
        ? "Payment request failed. Please check your phone number and try again."
        : "Unable to initiate payment. Please try again later.";
      return NextResponse.json({ error: safeError }, { status: 400 });
    }

    if (data.reference || data.tx_ref) {
      await admin.from("deposits")
        .update({ paychangu_ref: data.reference || data.tx_ref })
        .eq("id", deposit.id);
    }

    return NextResponse.json({
      depositId: deposit.id,
      chargeId,
      status: data.status || "pending",
      message: data.message || "Check your phone to authorize the payment",
    });
  } catch {
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
