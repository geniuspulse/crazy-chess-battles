import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import GameBoard from "@/components/game/game-board";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();

  const { data: game } = await supabase
    .from("games")
    .select(`
      id, status, winner, time_control, initial_minutes, increment_seconds,
      pgn, fen, move_count, rated, created_at, ended_at,
      white_player_id, black_player_id
    `)
    .eq("id", id)
    .single();

  if (!game) notFound();

  // Get player profiles
  const { data: whitePlayer } = await supabase
    .from("profiles")
    .select("username, display_name, rating")
    .eq("id", game.white_player_id)
    .single();

  const { data: blackPlayer } = await supabase
    .from("profiles")
    .select("username, display_name, rating")
    .eq("id", game.black_player_id)
    .single();

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      {/* Game header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold capitalize">{game.time_control} Game</h1>
          <p className="text-sm text-ccb-muted">
            {game.status === "playing" ? "In progress" : `Finished — ${game.winner || "draw"}`}
          </p>
        </div>
        {game.rated && (
          <span className="badge bg-ccb-primary/10 text-ccb-primary">Ranked</span>
        )}
      </div>

      {/* Players */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center">
            <span className="text-lg">♔</span>
          </div>
          <div>
            <div className="text-sm font-medium">{whitePlayer?.display_name || whitePlayer?.username || "White"}</div>
            <div className="text-xs text-ccb-muted">{whitePlayer?.rating ?? "—"}</div>
          </div>
        </div>

        <div className="text-sm text-ccb-muted font-mono">
          {game.move_count} moves
        </div>

        <div className="flex items-center gap-3">
          <div>
            <div className="text-sm font-medium text-right">{blackPlayer?.display_name || blackPlayer?.username || "Black"}</div>
            <div className="text-xs text-ccb-muted text-right">{blackPlayer?.rating ?? "—"}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-ccb-surface border border-ccb-border flex items-center justify-center">
            <span className="text-lg">♚</span>
          </div>
        </div>
      </div>

      {/* Board */}
      <GameBoard fen={game.fen || undefined} />
    </div>
  );
}
