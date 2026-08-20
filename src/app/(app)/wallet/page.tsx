export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WalletClient from "./wallet-client";

export default async function WalletPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/wallet");
  }

  // Use select("*") — PostgREST caches schema and may not know about
  // recently added columns like berry_balance. select("*") returns all
  // columns PostGREST knows about without validating individual names.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Gracefully handle missing deposits table — don't crash the whole page
  let deposits: any[] = [];
  try {
    const { data, error } = await supabase
      .from("deposits")
      .select("id, amount_cents, method, status, created_at, charge_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) deposits = data;
  } catch {
    // deposits table may not exist yet — page still works without history
  }

  return (
    <WalletClient
      balanceCents={profile?.wallet_balance_cents || 0}
      berryBalance={profile?.berry_balance || 0}
      email={user.email || ""}
      deposits={deposits}
      phone={null}
    />
  );
}
