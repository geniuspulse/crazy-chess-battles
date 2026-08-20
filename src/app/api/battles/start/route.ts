import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TIME_CONTROLS: Record<string, { minutes: number; increment: number }> = {
  bullet:    { minutes: 1,  increment: 0 },
  blitz3:    { minutes: 3,  increment: 2 },
  blitz:     { minutes: 5,  increment: 0 },
  rapid:     { minutes: 10, increment: 0 },
  rapid15:   { minutes: 15, increment: 10 },
  classical: { minutes: 30, increment: 0 },
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { battleId, timeControl } = await req.json();
    if (!battleId) return NextResponse.json({ error: "Battle ID required" }, { status: 400 });

    const admin = createAdminClient();

    const { data: battle } = await admin
      .from("battles")
      .select("*")
      .eq("id", battleId)
      .single();

    if (!battle) return NextResponse.json({ error: "Battle not found" }, { status: 404 });

    if (battle.white_player_id !== user.id && battle.black_player_id !== user.id) {
      return NextResponse.json({ error: "Not a battle participant" }, { status: 403 });
    }

    if (battle.status !== "pending") {
      return NextResponse.json({ error: "Battle is not pending" }, { status: 400 });
    }

    if (battle.game_id) {
      return NextResponse.json({ gameId: battle.game_id });
    }

    // Determine time control: client-provided > battle record > config default
    let minutes = 5;
    let increment = 2;

    if (timeControl && TIME_CONTROLS[timeControl]) {
      minutes = TIME_CONTROLS[timeControl].minutes;
      increment = TIME_CONTROLS[timeControl].increment;
    } else {
      // Try reading from battle record (may have time_control field)
      const battleTC = (battle as any).time_control;
      if (battleTC && TIME_CONTROLS[battleTC]) {
        minutes = TIME_CONTROLS[battleTC].minutes;
        increment = TIME_CONTROLS[battleTC].increment;
      } else {
        // Fall back to config
        const { data: config } = await admin.from("battle_config").select("*").limit(1).single();
        minutes = config?.initial_minutes ?? 5;
        increment = config?.increment_seconds ?? 2;
      }
    }

    const { data: gameId, error: gameErr } = await admin.rpc("create_game", {
      p_white_id: battle.white_player_id,
      p_black_id: battle.black_player_id,
      p_white_rating: battle.white_rating ?? 1200,
      p_black_rating: battle.black_rating ?? 1200,
      p_time_control: "battle",
      p_initial_minutes: minutes,
      p_increment_seconds: increment,
      p_rated: true,
    });

    if (gameErr || !gameId) {
      console.error("Game creation failed:", gameErr);
      return NextResponse.json({ error: "Failed to start game" }, { status: 500 });
    }

    await admin
      .from("battles")
      .update({
        game_id: gameId,
        status: "playing",
        started_at: new Date().toISOString(),
      })
      .eq("id", battleId);

    return NextResponse.json({ gameId, battleId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to start battle" }, { status: 500 });
  }
}
