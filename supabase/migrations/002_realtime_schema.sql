-- CCB Real-Time Game Schema (Vercel + Supabase)
-- Created: 2026-08-15
-- This migration adds matchmaking + clock support for serverless real-time play

-- ============================================================
-- 1. MATCHMAKING QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  time_control TEXT NOT NULL,
  rated BOOLEAN NOT NULL DEFAULT TRUE,
  rating INT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matchmaking_time_control ON public.matchmaking_queue(time_control);
CREATE INDEX idx_matchmaking_rating ON public.matchmaking_queue(rating);
CREATE INDEX idx_matchmaking_joined_at ON public.matchmaking_queue(joined_at);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read matchmaking queue" ON public.matchmaking_queue FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert own queue entry" ON public.matchmaking_queue FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Users can delete own queue entry" ON public.matchmaking_queue FOR DELETE USING (auth.uid() = player_id);

-- ============================================================
-- 2. CLOCK FIELDS ON GAMES TABLE
-- ============================================================
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS white_clock_ms INT;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS black_clock_ms INT;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS last_move_at TIMESTAMPTZ;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS turn TEXT DEFAULT 'white' CHECK (turn IN ('white', 'black'));

-- ============================================================
-- 3. ENABLE REALTIME ON GAMES TABLE
-- ============================================================
-- Supabase Realtime needs the table added to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;

-- ============================================================
-- 4. FUNCTION TO CREATE A GAME FROM MATCHMAKING
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_game(
  p_white_id UUID,
  p_black_id UUID,
  p_white_rating INT,
  p_black_rating INT,
  p_time_control TEXT,
  p_initial_minutes INT,
  p_increment_seconds INT,
  p_rated BOOLEAN
) RETURNS UUID AS $$
DECLARE
  game_id UUID;
  initial_ms INT;
BEGIN
  initial_ms := p_initial_minutes * 60 * 1000;
  
  INSERT INTO public.games (
    white_player_id, black_player_id,
    white_rating, black_rating,
    time_control, initial_minutes, increment_seconds,
    rated, status, fen, turn, move_count,
    white_clock_ms, black_clock_ms, last_move_at
  ) VALUES (
    p_white_id, p_black_id,
    p_white_rating, p_black_rating,
    p_time_control, p_initial_minutes, p_increment_seconds,
    p_rated, 'playing',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'white', 0,
    initial_ms, initial_ms, now()
  ) RETURNING id INTO game_id;
  
  RETURN game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. CLEANUP OLD MATCHMAKING ENTRIES (auto-expire after 60s)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_matchmaking()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.matchmaking_queue
  WHERE joined_at < now() - interval '60 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
