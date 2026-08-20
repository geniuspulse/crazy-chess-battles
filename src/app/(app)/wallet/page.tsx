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

  // Only select columns that actually exist on the profiles table.
  // email comes from auth.users (user.email), not profiles.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("wallet_balance_cents, berry_balance, username, display_name")
    .eq("id", user.id)
    .single();

  // TEMP DEBUG — remove after fixing
  console.log("[WALLET DEBUG] user.id:", user.id);
  console.log("[WALLET DEBUG] profile:", JSON.stringify(profile));
  console.log("[WALLET DEBUG] profileError:", JSON.stringify(profileError));

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
    <>
      <div style={{ position: "fixed", top: 0, right: 0, zIndex: 9999, background: "red", color: "white", padding: "8px", fontSize: "12px", maxWidth: "400px" }}>
        DEBUG: uid={user.id?.substring(0, 8)} | profile={profile ? "yes" : "null"} | err={profileError?.message || "none"} | bal={profile?.wallet_balance_cents ?? "n/a"}
      </div>
      <WalletClient
        balanceCents={profile?.wallet_balance_cents || 0}
        berryBalance={profile?.berry_balance || 0}
        email={user.email || ""}
        deposits={deposits}
        phone={null}
      />
    </>
  );
}
