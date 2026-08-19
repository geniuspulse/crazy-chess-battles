import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Awards berries to the winner of a quick match game.
 * Only awards for: rated=true, tournament_id=null, no battle record, not vs bot.
 * Returns the number of berries awarded (0 if not eligible).
 */
export async function awardBerries(gameId: string, winnerId: string): Promise<number> {
  try {
    const admin = createAdminClient();

    // Get the game
    const { data: game } = await admin
      .from("games")
      .select("id, rated, tournament_id, white_player_id, black_player_id, time_control")
      .eq("id", gameId)
      .single();

    if (!game) return 0;

    // Must be rated
    if (!game.rated) return 0;

    // Must NOT be a tournament game
    if (game.tournament_id) return 0;

    // Must NOT be a battle game
    const { data: battle } = await admin
      .from("battles")
      .select("id")
      .or(`game_id.eq.${gameId},armageddon_game_id.eq.${gameId}`)
      .limit(1)
      .single();

    if (battle) return 0;

    // Must NOT be vs bot (bot user ID)
    const BOT_USER_ID = "3699502b-57bf-498a-bc2d-11385fd9d317";
    if (game.white_player_id === BOT_USER_ID || game.black_player_id === BOT_USER_ID) return 0;

    // Get berry config
    const { data: config } = await admin
      .from("berry_config")
      .select("berries_per_win, enabled")
      .limit(1)
      .single();

    if (!config || !config.enabled) return 0;

    const berries = config.berries_per_win;

    // Credit berries
    await admin.rpc("credit_berries", {
      p_user_id: winnerId,
      p_amount: berries,
      p_game_id: gameId,
      p_description: `Quick match win (${game.time_control})`,
    });

    return berries;
  } catch (e) {
    console.error("Berry award error:", e);
    return 0;
  }
}
