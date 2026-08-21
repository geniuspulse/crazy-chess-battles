export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ChallengeAccept from "./challenge-accept";
import ChallengeWaiting from "./challenge-waiting";

export default async function ChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const refCode = typeof sp.ref === "string" ? sp.ref : null;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not logged in, redirect to login with return path
  if (!user) {
    // Preserve ref code in the redirect chain
    const refParam = refCode ? `&ref=${refCode}` : "";
    redirect(`/login?redirect=/challenge/${id}${refParam}`);
  }

  // Fetch challenge
  const { data: challenge, error } = await admin
    .from("challenges")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !challenge) {
    notFound();
  }

  // If already accepted and game exists, redirect to game
  if (challenge.status === "accepted" && challenge.game_id) {
    redirect(`/game/${challenge.game_id}`);
  }

  if (challenge.status === "expired" || challenge.status === "cancelled") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="card max-w-md w-full text-center space-y-3">
          <h1 className="text-2xl font-bold">Challenge Unavailable</h1>
          <p className="text-ccb-muted">
            This challenge has been {challenge.status}.
          </p>
          <a href="/play" className="btn-primary inline-block">Back to Play</a>
        </div>
      </div>
    );
  }

  // If user is the challenger, show waiting screen
  if (challenge.challenger_id === user.id) {
    const challengeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://crazychessbattles.live"}/challenge/${id}`;
    return <ChallengeWaiting url={challengeUrl} />;
  }

  // Check expiry
  if (new Date(challenge.expires_at) < new Date()) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="card max-w-md w-full text-center space-y-3">
          <h1 className="text-2xl font-bold">Challenge Expired</h1>
          <p className="text-ccb-muted">This challenge is no longer available.</p>
          <a href="/play" className="btn-primary inline-block">Back to Play</a>
        </div>
      </div>
    );
  }

  // Fetch challenger profile
  const { data: challengerProfile } = await admin
    .from("profiles")
    .select("username, display_name, rating, avatar_url")
    .eq("id", challenge.challenger_id)
    .single();

  // Show accept screen
  return (
    <ChallengeAccept
      challengeId={id}
      challengerName={challengerProfile?.display_name || challengerProfile?.username || "Player"}
      challengerRating={challengerProfile?.rating || 1200}
      timeControl={`${challenge.initial_minutes}+${challenge.increment_seconds}`}
      rated={challenge.rated}
    />
  );
}
