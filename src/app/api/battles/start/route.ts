import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Start a battle game — called when both players are matched.
 * Creates the actual chess game linked to the battle.
 * Body: { battleId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { battleId } = await req.json();
    if (!battleId) return NextResponse.json({ error: "Battle ID required" }, { status: 400 });

    const admin = createAdminClient();

    // Load battle
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

    // Check if game already exists
    if (battle.game_id) {
      return NextResponse.json({ gameId: battle.game_id });
    }

    // Get config for time control
    const { data: config } = await admin.from("battle_config").select("*").limit(1).single();
    const minutes = config?.initial_minutes ?? 5;
    const increment = config?.increment_seconds ?? 2;

    // Create the chess game
    const { data: gameId, error: gameErr } = await admin.rpc("create_game", {
      p_white_id: battle.white_player_id,
      p_black_id: battle.black_player_id,
      p_initial_minutes: minutes,
      p_increment_seconds: increment,
      p_rated: true,
      p_tournament_id: null,
      p_time_control: "battle",
    });

    if (gameErr || !gameId) {
      console.error("Game creation failed:", gameErr);
      return NextResponse.json({ error: "Failed to start game" }, { status: 500 });
    }

    // Link game to battle and update status
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
