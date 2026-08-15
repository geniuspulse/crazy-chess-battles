import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await supabase
      .from("matchmaking_queue")
      .delete()
      .eq("player_id", user.id);

    return NextResponse.json({ status: "left" });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
