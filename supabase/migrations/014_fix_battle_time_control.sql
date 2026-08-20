-- Fix: games_time_control_check constraint only allowed
-- 'bullet' | 'blitz' | 'rapid' | 'classical', but battle/armageddon games
-- pass time_control = 'battle' / 'armageddon'. This caused EVERY stake
-- battle (quick match AND challenge accept) to fail with a check
-- constraint violation when create_game() tried to INSERT the game row,
-- surfacing to users as "Failed to start game" right after their stake
-- was already locked in escrow.
--
-- Applied directly to production on 2026-08-20; this migration file
-- keeps the schema history in sync and makes it reproducible for
-- fresh environments / other deploys.

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_time_control_check;
ALTER TABLE public.games ADD CONSTRAINT games_time_control_check
  CHECK (time_control = ANY (ARRAY['bullet'::text, 'blitz'::text, 'rapid'::text, 'classical'::text, 'battle'::text, 'armageddon'::text]));
