import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check if the current user has an active battle (pending/playing/draw_armageddon)
 * blocking them from starting a new one.
 *
 * Self-healing: if the battle is stuck in "pending" with no game_id (i.e. game
 * creation previously failed — see the create_game RPC/constraint bug fixed on
 * 2026-08-20), this endpoint automatically retries creating the game before
 * reporting back. If the retry also fails, it reports `stuck: true` so the
 * client can offer a manual cancel + refund instead of trapping the user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: battle } = await admin
      .from("battles")
      .select("*")
      .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
      .in("status", ["pending", "playing", "draw_armageddon"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!battle) return NextResponse.json({ active: false });

    // Already has a live/armageddon game — just point the client at it.
    const currentGameId = battle.status === "draw_armageddon" ? battle.armageddon_game_id : battle.game_id;
    if (currentGameId) {
      return NextResponse.json({ active: true, battleId: battle.id, gameId: currentGameId, status: battle.status });
    }

    if (battle.status !== "pending") {
      // draw_armageddon without a game_id yet — settlement will create it shortly.
      return NextResponse.json({ active: true, battleId: battle.id, status: battle.status, stuck: false });
    }

    // Stuck pending, no game — self-heal by retrying game creation now that
    // the RPC signature / time_control constraint bug is fixed.
    const { data: config } = await admin.from("battle_config").select("*").limit(1).single();
    const minutes = config?.initial_minutes ?? 5;
    const increment = config?.increment_seconds ?? 2;

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
      console.error("Self-heal game creation retry failed:", gameErr);
      return NextResponse.json({
        active: true,
        battleId: battle.id,
        status: "pending",
        stuck: true,
        stakeCents: battle.stake_cents,
        createdAt: battle.created_at,
      });
    }

    await admin
      .from("battles")
      .update({ game_id: gameId, status: "playing", started_at: new Date().toISOString() })
      .eq("id", battle.id);

    return NextResponse.json({ active: true, battleId: battle.id, gameId, status: "playing" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
