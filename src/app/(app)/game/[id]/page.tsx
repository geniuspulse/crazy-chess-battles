import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import GameClient from "@/components/game/game-client";
import type { GameState } from "@/hooks/use-realtime-game";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();

  if (!game) notFound();

  const gameState: GameState = {
    id: game.id,
    fen: game.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    pgn: game.pgn,
    turn: game.turn || "white",
    status: game.status,
    winner: game.winner,
    move_count: game.move_count || 0,
    white_clock_ms: game.white_clock_ms,
    black_clock_ms: game.black_clock_ms,
    last_move_at: game.last_move_at,
    white_player_id: game.white_player_id,
    black_player_id: game.black_player_id,
    white_rating: game.white_rating,
    black_rating: game.black_rating,
    white_rating_change: game.white_rating_change,
    black_rating_change: game.black_rating_change,
    time_control: game.time_control,
    initial_minutes: game.initial_minutes,
    increment_seconds: game.increment_seconds,
    rated: game.rated,
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <GameClient gameId={id} initialGame={gameState} currentUserId={user.id} />
    </div>
  );
}
