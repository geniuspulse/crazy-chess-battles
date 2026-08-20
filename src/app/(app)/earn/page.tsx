export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();

  // Check if the user has completed a game (for "Play Your First Game")
  const { count: gamesCount } = await admin
    .from("games")
    .select("id", { count: "exact", head: true })
    .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
    .not("status", "eq", "playing");

  const hasPlayedGame = (gamesCount ?? 0) > 0;

  // Profile completeness (for "Complete Your Profile")
  const profileComplete = Boolean(profile?.username && profile?.display_name && profile?.avatar_url);

  // Already-claimed one-time actions, so state survives a refresh
  const { data: claimedRows } = await admin
    .from("engagement_log")
    .select("action")
    .eq("user_id", user.id)
    .in("action", ["share_app", "whatsapp_status", "first_game", "profile_complete"]);

  const claimedActions = (claimedRows ?? []).map((r: any) => r.action);

  return (
    <EarnClient
      berryBalance={profile?.berry_balance || 0}
      userId={user.id}
      hasPlayedGame={hasPlayedGame}
      profileComplete={profileComplete}
      initialClaimedActions={claimedActions}
    />
  );
}
