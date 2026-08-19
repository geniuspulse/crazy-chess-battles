import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Ensure type matches allowed DB constraint ('arena' or 'swiss')
    const dbType = ["arena", "swiss"].includes(type) ? type : "swiss";
    const GAME_TIME_CONTROL_MAP: Record<string, string> = {
      bullet: "bullet", blitz3: "blitz", blitz: "blitz",
      rapid: "rapid", rapid15: "rapid", classical: "classical",
    };
    const dbTimeControl = GAME_TIME_CONTROL_MAP[timeControl] || "blitz";

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
        prize_distribution: { type: "percentage", payouts: [
          { rank: 1, percentage: 40 },
          { rank: 2, percentage: 20 },
          { rank: 3, percentage: 18 },
          { rank: 4, percentage: 12 },
          { rank: 5, percentage: 10 },
        ] },
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
