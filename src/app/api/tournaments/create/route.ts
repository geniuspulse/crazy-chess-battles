import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PRIZE_SPLITS_BY_TYPE, DEFAULT_PRIZE_SPLITS } from "@/lib/tournament/prizes";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      description,
      type = "swiss",
      timeControl = "blitz",
      initialMinutes = 5,
      incrementSeconds = 0,
      maxPlayers,
      rounds,
      durationMinutes,
      startsAt,
      endsAt,
      entryFeeCents = 0,
      prizePoolCents = 0,
      minRating = 0,
      maxRating,
    } = body;

    if (!name || !startsAt) {
      return NextResponse.json(
        { error: "Tournament name and start time are required" },
        { status: 400 }
      );
    }

    // Tournament format — arena, swiss, and knockout are all valid DB values
    const dbType = ["arena", "swiss", "knockout"].includes(type) ? type : "swiss";
    const GAME_TIME_CONTROL_MAP: Record<string, string> = {
      bullet: "bullet", blitz3: "blitz", blitz: "blitz",
      rapid: "rapid", rapid15: "rapid", classical: "classical",
    };
    const dbTimeControl = GAME_TIME_CONTROL_MAP[timeControl] || "blitz";

    // Prize split depends on format — knockout rewards top 4, swiss/arena reward top 5
    const payouts = PRIZE_SPLITS_BY_TYPE[dbType] || DEFAULT_PRIZE_SPLITS;

    const { data: tournament, error } = await supabase
      .from("tournaments")
      .insert({
        name,
        description: description || null,
        type: dbType,
        time_control: dbTimeControl,
        initial_minutes: Number(initialMinutes),
        increment_seconds: Number(incrementSeconds || 0),
        max_players: maxPlayers ? Number(maxPlayers) : null,
        rounds: rounds ? Number(rounds) : null,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
        starts_at: startsAt,
        ends_at: endsAt || null,
        entry_fee_cents: Number(entryFeeCents || 0),
        prize_pool_cents: Number(prizePoolCents || 0),
        prize_distribution: { type: "percentage", payouts },
        min_rating: Number(minRating || 0),
        max_rating: maxRating ? Number(maxRating) : null,
        created_by: user.id,
        status: "upcoming",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tournament });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Failed to create tournament" },
      { status: 500 }
    );
  }
}
