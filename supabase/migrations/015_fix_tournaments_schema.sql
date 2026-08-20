-- Fix multiple tournaments/games schema mismatches surfaced by the audit
-- after "Create Tournament" failed with: Could not find the 'prize_distribution'
-- column of 'tournaments' in the schema cache.
--
-- All three changes applied directly to production on 2026-08-20; this
-- migration keeps schema history in sync for fresh environments.

-- 1) prize_distribution: the create route has always written this JSONB field
--    (payout splits by tournament type), and the tournament detail page /
--    finish route read it, but the column was never created.
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS prize_distribution jsonb NOT NULL DEFAULT '{"type": "percentage", "payouts": []}'::jsonb;

-- 2) type check constraint: the create route and the create-tournament form
--    both treat 'knockout' as a valid tournament type, but the DB constraint
--    only allowed 'arena' | 'swiss'.
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_type_check;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_type_check
  CHECK (type = ANY (ARRAY['arena'::text, 'swiss'::text, 'knockout'::text]));

-- 3) games.tournament_round: tournament start, advance-round, and auto-start
--    all insert this column, and the game results/draw routes select it, but
--    it was never created on the games table.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS tournament_round integer;

-- 4) tournament_participants.paid_entry_fee: the join route inserts this to
--    track whether the entry fee was debited, but the column was missing.
ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS paid_entry_fee boolean NOT NULL DEFAULT false;
