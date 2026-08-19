-- Crazy Chess Battles — In-Game Chat
-- Created: 2026-08-19
-- Stores chat messages between players during a game

CREATE TABLE IF NOT EXISTS public.game_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_chat ENABLE ROW LEVEL SECURITY;

-- Players can only see messages in games they're part of
CREATE POLICY "Players can read game chat" ON public.game_chat
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_chat.game_id
      AND (g.white_player_id = auth.uid() OR g.black_player_id = auth.uid())
    )
  );

-- Players can only send messages in games they're part of
CREATE POLICY "Players can send game chat" ON public.game_chat
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_chat.game_id
      AND (g.white_player_id = auth.uid() OR g.black_player_id = auth.uid())
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_chat;
