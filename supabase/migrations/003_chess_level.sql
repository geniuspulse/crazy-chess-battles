-- Crazy Chess Battles — Chess Level & Rating System
-- Created: 2026-08-19
-- Adds chess_level to profiles and updates the signup trigger to set
-- initial Elo based on self-reported skill: Beginner=400, Intermediate=1500, Expert=2500

-- 1. Add chess_level column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chess_level TEXT;

-- 2. Update the auto-create-profile trigger to read chess_level from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_chess_level TEXT;
  v_rating INT;
BEGIN
  v_chess_level := COALESCE(NEW.raw_user_meta_data->>'chess_level', 'beginner');
  
  v_rating := CASE 
    WHEN v_chess_level = 'expert' THEN 2500
    WHEN v_chess_level = 'intermediate' THEN 1500
    ELSE 400
  END;
  
  INSERT INTO public.profiles (id, username, display_name, chess_level, rating)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_chess_level,
    v_rating
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill existing profiles (shouldn't be any after seed cleanup)
UPDATE public.profiles SET chess_level = 'beginner' WHERE chess_level IS NULL;
