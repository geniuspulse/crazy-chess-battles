import { createAdminClient } from "@/lib/supabase/admin";

const BOT_USER_ID = "3699502b-57bf-498a-bc2d-11385fd9d317";

// Berry rewards for beating the computer, by difficulty
const BOT_BERRY_REWARDS: Record<string, number> = {
  easy: 5,
  medium: 10,
  hard: 10,
};

/**
 * Awards berries to the winner of a game.
 *
 * - Quick match (PvP, non-tournament, non-battle): uses config.berries_per_win (default 10)
 * - Bot game (vs computer): 5 for easy, 10 for medium, 10 for hard
 *
 * Tournament games and battle games are excluded (they have their own reward systems).
 * Returns the number of berries awarded (0 if not eligible).
 */
export async function awardBerries(gameId: string, winnerId: string): Promise<number> {
  try {
    const admin = createAdminClient();

    // Get the game
    const { data: game } = await admin
      .from("games")
      .select("id, rated, tournament_id, white_player_id, black_player_id, time_control, status")
      .eq("id", gameId)
      .single();

    if (!game) return 0;

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

    const isBotGame =
      game.white_player_id === BOT_USER_ID || game.black_player_id === BOT_USER_ID;

    // Get berry config
    const { data: config } = await admin
      .from("berry_config")
      .select("berries_per_win, enabled")
      .limit(1)
      .single();

    if (!config || !config.enabled) return 0;

    let berries = 0;
    let description = "";

    if (isBotGame) {
      // Bot game — award based on difficulty
      // The difficulty isn't stored on the game record, but we can infer it
      // from the save-bot-game call. We store it as a note on the game instead.
      // Since the game record doesn't have a difficulty column, we use a
      // separate lookup: check if there's a bot_game_difficulty value we stored.
      // Fallback: we pass difficulty via the game's pgn notes or just default to medium.
      // Actually, let's store difficulty in a simple lookup table or just award
      // based on what we can determine. The save-bot-game route knows the difficulty,
      // so we'll handle bot berries there directly instead.
      //
      // For the awardBerries path (called from move/resign/timeout), bot games
      // won't typically arrive here since they're saved via save-bot-game.
      // But as a safety net, award the standard amount.
      const berriesPerWin = config.berries_per_win || 10;
      berries = berriesPerWin;
      description = `Bot game win (${game.time_control})`;
    } else {
      // Quick match PvP
      berries = game.rated ? (config.berries_per_win || 10) : 15;
      description = `Quick match win (${game.time_control}${game.rated ? "" : " · casual"})`;
    }

    if (berries <= 0) return 0;

    // Credit berries
    await admin.rpc("credit_berries", {
      p_user_id: winnerId,
      p_amount: berries,
      p_game_id: gameId,
      p_description: description,
    });

    // Trigger referral activation for BOTH players (winner and loser)
    await admin.rpc("check_referral_activation", { p_user_id: winnerId, p_action: "quick_match" });
    const loserId = game.white_player_id === winnerId ? game.black_player_id : game.white_player_id;
    if (loserId && loserId !== BOT_USER_ID) {
      await admin.rpc("check_referral_activation", { p_user_id: loserId, p_action: "quick_match" });
    }

    return berries;
  } catch (e) {
    console.error("Berry award error:", e);
    return 0;
  }
}

/**
 * Awards berries for a bot game win, based on difficulty.
 * Called directly from /api/games/save-bot-game when the player wins.
 */
export async function awardBotGameBerries(
  gameId: string,
  winnerId: string,
  difficulty: string
): Promise<number> {
  try {
    const admin = createAdminClient();

    // Get berry config to check if enabled
    const { data: config } = await admin
      .from("berry_config")
      .select("enabled")
      .limit(1)
      .single();

    if (!config || !config.enabled) return 0;

    const berries = BOT_BERRY_REWARDS[difficulty] ?? 10;
    if (berries <= 0) return 0;

    // Credit berries
    await admin.rpc("credit_berries", {
      p_user_id: winnerId,
      p_amount: berries,
      p_game_id: gameId,
      p_description: `Beat the ${difficulty} bot`,
    });

    // Trigger referral activation
    await admin.rpc("check_referral_activation", { p_user_id: winnerId, p_action: "quick_match" });

    return berries;
  } catch (e) {
    console.error("Bot berry award error:", e);
    return 0;
  }
}
