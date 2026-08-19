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

  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_balance_cents, berry_balance, username, display_name, email, phone")
    .eq("id", user.id)
    .single();

  const { data: deposits } = await supabase
    .from("deposits")
    .select("id, amount_cents, method, status, created_at, charge_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <WalletClient
      balanceCents={profile?.wallet_balance_cents || 0}
      berryBalance={profile?.berry_balance || 0}
      email={profile?.email || user.email || ""}
      deposits={deposits || []}
      phone={profile?.phone || null}
    />
  );
}
