import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Total users
    const { count: totalUsers } = await admin
      .from("profiles").select("*", { count: "exact", head: true });

    // Games today
    const { count: gamesToday } = await admin
      .from("games").select("*", { count: "exact", head: true })
      .gte("created_at", todayISO);

    // Active tournaments
    const { count: activeTournaments } = await admin
      .from("tournaments").select("*", { count: "exact", head: true })
      .in("status", ["upcoming", "active"]);

    // Pending withdrawals
    const { count: pendingWithdrawals } = await admin
      .from("withdrawals").select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // Total deposits (completed)
    const { data: depositsData } = await admin
      .from("deposits").select("amount_cents")
      .eq("status", "success");
    const totalDeposits = depositsData?.reduce((sum, d) => sum + (d.amount_cents || 0), 0) || 0;

    // Total withdrawals (completed)
    const { data: withdrawalsData } = await admin
      .from("withdrawals").select("amount_cents")
      .in("status", ["approved", "completed"]);
    const totalWithdrawals = withdrawalsData?.reduce((sum, w) => sum + (w.amount_cents || 0), 0) || 0;

    // Platform revenue (entry fee deductions — tournament fee percentage)
    // For now, track total tournament prize pools as a proxy
    const { data: tournamentsData } = await admin
      .from("tournaments").select("prize_pool_cents, entry_fee_cents, status")
      .neq("status", "cancelled");
    let totalPrizePools = 0;
    let totalEntryFees = 0;
    for (const t of tournamentsData || []) {
      totalPrizePools += t.prize_pool_cents || 0;
    }

    return NextResponse.json({
      totalUsers,
      gamesToday,
      activeTournaments,
      pendingWithdrawals,
      totalDeposits,
      totalWithdrawals,
      totalPrizePools,
      walletLiquidity: totalDeposits - totalWithdrawals - totalPrizePools,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
