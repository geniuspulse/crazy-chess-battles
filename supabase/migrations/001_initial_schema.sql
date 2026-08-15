-- Crazy Chess Battles — Initial Schema
-- Created: 2026-08-15
-- Database: Supabase (PostgreSQL)

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  country TEXT,
  
  -- Glicko-2 rating fields
  rating INT NOT NULL DEFAULT 1500,
  rating_deviation REAL NOT NULL DEFAULT 350,
  rating_volatility REAL NOT NULL DEFAULT 0.06,
  
  -- Career stats
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  
  -- Tournament stats
  tournaments_played INT NOT NULL DEFAULT 0,
  tournaments_won INT NOT NULL DEFAULT 0,
  
  -- Status
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. GAMES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  black_player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  white_rating INT,
  black_rating INT,
  white_rating_change INT,
  black_rating_change INT,
  
  -- Time control
  time_control TEXT NOT NULL CHECK (time_control IN ('bullet', 'blitz', 'rapid', 'classical')),
  initial_minutes INT NOT NULL,
  increment_seconds INT NOT NULL DEFAULT 0,
  
  -- Game state
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'checkmate', 'resign', 'timeout', 'draw', 'abort', 'stalemate')),
  winner TEXT CHECK (winner IN ('white', 'black', NULL)),
  
  -- Game data
  pgn TEXT,
  fen TEXT,
  move_count INT NOT NULL DEFAULT 0,
  opening TEXT,
  
  -- Meta
  rated BOOLEAN NOT NULL DEFAULT TRUE,
  tournament_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_games_white_player ON public.games(white_player_id);
CREATE INDEX idx_games_black_player ON public.games(black_player_id);
CREATE INDEX idx_games_status ON public.games(status);
CREATE INDEX idx_games_created_at ON public.games(created_at DESC);
CREATE INDEX idx_games_tournament ON public.games(tournament_id);

-- ============================================================
-- 3. TOURNAMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Tournament type
  type TEXT NOT NULL CHECK (type IN ('arena', 'swiss')),
  time_control TEXT NOT NULL CHECK (time_control IN ('bullet', 'blitz', 'rapid', 'classical')),
  initial_minutes INT NOT NULL,
  increment_seconds INT NOT NULL DEFAULT 0,
  
  -- Tournament config
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'finished', 'cancelled')),
  max_players INT,
  min_rating INT DEFAULT 0,
  max_rating INT,
  
  -- Swiss-specific
  rounds INT,
  current_round INT DEFAULT 0,
  
  -- Arena-specific
  duration_minutes INT,
  
  -- Scheduling
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Entry fee (Phase 2 — free for MVP)
  entry_fee_cents INT DEFAULT 0,
  prize_pool_cents INT DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_tournaments_starts_at ON public.tournaments(starts_at);

-- ============================================================
-- 4. TOURNAMENT PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Swiss pairing
  seed INT,
  
  -- Scoring
  score REAL NOT NULL DEFAULT 0,
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  
  -- Arena-specific
  streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  berserks INT NOT NULL DEFAULT 0,
  
  -- Final placement
  final_rank INT,
  
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tournament_id, player_id)
);

CREATE INDEX idx_tournament_participants_tournament ON public.tournament_participants(tournament_id);
CREATE INDEX idx_tournament_participants_player ON public.tournament_participants(player_id);
CREATE INDEX idx_tournament_participants_score ON public.tournament_participants(tournament_id, score DESC);

-- ============================================================
-- 5. TOURNAMENT ROUNDS (Swiss)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  pairings JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, round_number)
);

-- ============================================================
-- 6. LEADERBOARD (cached for performance)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leaderboard (
  player_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL,
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  tournament_wins INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refresh leaderboard function
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.leaderboard (player_id, rating, games_played, wins, tournament_wins, updated_at)
  SELECT 
    p.id,
    p.rating,
    p.games_played,
    p.wins,
    p.tournaments_won,
    now()
  FROM public.profiles p
  WHERE p.is_banned = FALSE
  ON CONFLICT (player_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    games_played = EXCLUDED.games_played,
    wins = EXCLUDED.wins,
    tournament_wins = EXCLUDED.tournament_wins,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. ANTI-CHEAT FLAGS (Phase 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anti_cheat_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Detection metrics
  engine_match_rate REAL,
  avg_move_time_ms INT,
  suspicious_move_count INT,
  
  -- Review
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'clean', 'cheating', 'suspicious')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_anti_cheat_status ON public.anti_cheat_flags(status);

-- ============================================================
-- 8. AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles: anyone can read, users can update own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Games: anyone can read, authenticated can insert
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Games are viewable by everyone" ON public.games FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can create games" ON public.games FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Tournaments: anyone can read, authenticated can create
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can create tournaments" ON public.tournaments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Tournament participants: anyone can read, users can join
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants viewable by everyone" ON public.tournament_participants FOR SELECT USING (TRUE);
CREATE POLICY "Users can join tournaments" ON public.tournament_participants FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Users can update own participation" ON public.tournament_participants FOR UPDATE USING (auth.uid() = player_id);

-- Tournament rounds: anyone can read
ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rounds viewable by everyone" ON public.tournament_rounds FOR SELECT USING (TRUE);

-- Leaderboard: anyone can read
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaderboard viewable by everyone" ON public.leaderboard FOR SELECT USING (TRUE);

-- Anti-cheat: admin only
ALTER TABLE public.anti_cheat_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view anti-cheat flags" ON public.anti_cheat_flags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Audit log: admin only
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
