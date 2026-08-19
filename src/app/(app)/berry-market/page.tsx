export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BerryMarketClient from "./market-client";

export default async function BerryMarketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/berry-market");

  const { data: profile } = await supabase
    .from("profiles")
    .select("berry_balance, wallet_balance_cents, username, display_name")
    .eq("id", user.id)
    .single();

  return (
    <BerryMarketClient
      berryBalance={profile?.berry_balance || 0}
      walletBalanceCents={profile?.wallet_balance_cents || 0}
      userId={user.id}
    />
  );
}
