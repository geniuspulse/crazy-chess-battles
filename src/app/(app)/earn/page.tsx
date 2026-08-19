export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EarnClient from "./earn-client";

export default async function EarnPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/earn");

  const { data: profile } = await supabase
    .from("profiles")
    .select("berry_balance, username, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  return <EarnClient berryBalance={profile?.berry_balance || 0} userId={user.id} />;
}
