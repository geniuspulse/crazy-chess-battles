import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get the withdrawal
    const { data: withdrawal } = await admin
      .from("withdrawals")
      .select("*")
      .eq("id", id)
      .single();

    if (!withdrawal) return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    if (withdrawal.status !== "pending") return NextResponse.json({ error: "Withdrawal not pending" }, { status: 400 });

    // Mark as approved (funds already debited at request time)
    await admin
      .from("withdrawals")
      .update({ status: "approved", processed_by: user.id, processed_at: new Date().toISOString() })
      .eq("id", id);

    // Initiate Paychangu mobile money payout
    const chargeId = `wd_${withdrawal.id.slice(0, 8)}_${Date.now()}`;
    const amountMWK = Math.floor(withdrawal.amount_cents / 100);

    try {
      const payoutResponse = await fetch("https://api.paychangu.com/mobile-money/payouts/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: withdrawal.phone,
          mobile_money_operator_ref_id: withdrawal.operator_ref_id,
          amount: String(amountMWK),
          charge_id: chargeId,
        }),
      });

      const payoutData = await payoutResponse.json();

      if (payoutData.status === "success" || payoutData.status === "pending") {
        // Update with charge_id and mark as completed (Paychangu processes async)
        await admin
          .from("withdrawals")
          .update({ status: "completed", charge_id: chargeId })
          .eq("id", id);

        // Notify user
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "https://ccb-gules.vercel.app"}/api/notifications/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            userId: withdrawal.user_id,
            type: "withdrawal_approved",
            data: { amount: amountMWK, phone: withdrawal.phone, operator: withdrawal.operator_name },
          }),
        }).catch(() => {});

        // Log action
        await admin.from("admin_logs").insert({
          admin_id: user.id,
          action: "withdrawal_approve",
          target_type: "withdrawal",
          target_id: id,
          details: { amount: amountMWK, phone: withdrawal.phone, charge_id: chargeId },
        });

        return NextResponse.json({ status: "completed", chargeId });
      } else {
        // Payout failed — refund the wallet
        await admin.rpc("refund_withdrawal", { p_withdrawal_id: id, p_admin_id: user.id });
        return NextResponse.json({ error: payoutData.message || "Payout failed, wallet refunded" }, { status: 500 });
      }
    } catch (payoutErr: any) {
      // Payout API error — refund the wallet
      await admin.rpc("refund_withdrawal", { p_withdrawal_id: id, p_admin_id: user.id });
      return NextResponse.json({ error: "Payout API error, wallet refunded: " + payoutErr.message }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to approve withdrawal" }, { status: 500 });
  }
}
