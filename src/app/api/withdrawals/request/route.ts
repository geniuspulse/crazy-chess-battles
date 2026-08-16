import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { amountCents, phone, operatorRefId, operatorName } = await req.json();

    if (!amountCents || amountCents < 1000) {
      return NextResponse.json({ error: "Minimum withdrawal is MWK 10" }, { status: 400 });
    }
    if (!phone || !operatorRefId || !operatorName) {
      return NextResponse.json({ error: "Phone, operator required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Call the atomic request_withdrawal RPC
    const { data: withdrawalId, error } = await admin.rpc("request_withdrawal", {
      p_user_id: user.id,
      p_amount_cents: amountCents,
      p_phone: phone,
      p_operator_ref_id: operatorRefId,
      p_operator_name: operatorName,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ withdrawalId, status: "pending" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to request withdrawal" }, { status: 500 });
  }
}
