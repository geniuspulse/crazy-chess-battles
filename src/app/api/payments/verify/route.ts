import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { chargeId } = await req.json();
    if (!chargeId) return NextResponse.json({ error: "Charge ID required" }, { status: 400 });

    const admin = createAdminClient();
    let { data: deposit } = await admin
      .from("deposits")
      .select("id, user_id, amount_cents, status, method")
      .eq("charge_id", chargeId)
      .single();

    if (!deposit) {
      const { data: txDeposit } = await admin
        .from("deposits")
        .select("id, user_id, amount_cents, status, method")
        .eq("tx_ref", chargeId)
        .single();
      deposit = txDeposit;
    }

    if (!deposit) return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    if (deposit.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    if (deposit.status === "success") return NextResponse.json({ status: "success", depositId: deposit.id });

    let verifyUrl: string;
    if (deposit.method === "mobile_money") {
      verifyUrl = `https://api.paychangu.com/mobile-money/verify/${chargeId}`;
    } else {
      verifyUrl = `https://api.paychangu.com/charge-card/verify/${chargeId}`;
    }

    const res = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (data.status === "success" || data.data?.status === "success") {
      await admin.rpc("credit_wallet", {
        p_user_id: user.id,
        p_amount_cents: deposit.amount_cents,
      });
      await admin.from("deposits")
        .update({ status: "success", updated_at: new Date().toISOString() })
        .eq("id", deposit.id);
      return NextResponse.json({ status: "success", depositId: deposit.id, amount: deposit.amount_cents });
    }

    return NextResponse.json({ status: data.status || "pending", depositId: deposit.id });
  } catch {
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 });
  }
}
