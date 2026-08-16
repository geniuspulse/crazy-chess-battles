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

    const body = await req.json().catch(() => ({}));
    const adminNotes = body.notes || "Rejected by admin";

    // Fetch withdrawal info before refunding
    const { data: withdrawal } = await admin
      .from("withdrawals")
      .select("user_id, amount_cents, phone, operator_name")
      .eq("id", id)
      .single();

    if (!withdrawal) return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });

    // Refund wallet and mark rejected
    const { error } = await admin.rpc("refund_withdrawal", {
      p_withdrawal_id: id,
      p_admin_id: user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Add admin notes
    await admin
      .from("withdrawals")
      .update({ admin_notes: adminNotes })
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
        type: "withdrawal_rejected",
        data: { amount: Math.floor(withdrawal.amount_cents / 100), reason: adminNotes },
      }),
    }).catch(() => {});

    // Log action
    await admin.from("admin_logs").insert({
      admin_id: user.id,
      action: "withdrawal_reject",
      target_type: "withdrawal",
      target_id: id,
      details: { notes: adminNotes },
    });

    return NextResponse.json({ status: "rejected" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to reject withdrawal" }, { status: 500 });
  }
}
