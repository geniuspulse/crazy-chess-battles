import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TIME_CONTROLS: Record<string, { minutes: number; increment: number }> = {
  bullet: { minutes: 1, increment: 0 },
  blitz3: { minutes: 3, increment: 2 },
  blitz: { minutes: 5, increment: 0 },
  rapid: { minutes: 10, increment: 0 },
  rapid15: { minutes: 15, increment: 10 },
  classical: { minutes: 30, increment: 0 },
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { timeControl, rated, color } = await req.json();

    if (!timeControl || !TIME_CONTROLS[timeControl]) {
      return NextResponse.json({ error: "Invalid time control" }, { status: 400 });
    }

    const tc = TIME_CONTROLS[timeControl];

    const { data: challenge, error } = await supabase
      .from("challenges")
      .insert({
        challenger_id: user.id,
        time_control: timeControl,
        initial_minutes: tc.minutes,
        increment_seconds: tc.increment,
        rated: rated ?? true,
        color: color || "random",
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !challenge) {
      return NextResponse.json({ error: error?.message || "Failed to create challenge" }, { status: 500 });
    }

    return NextResponse.json({
      challengeId: challenge.id,
      url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://ccb-github.vercel.app"}/challenge/${challenge.id}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
