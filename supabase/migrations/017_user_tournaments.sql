-- User-created tournaments: min players, creator profit, berry prize pool
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS creator_profit_percent INTEGER DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS berry_prize_pool INTEGER DEFAULT 0;

-- min_players: minimum required players (if not met by start time, cancel + refund)
-- creator_profit_percent: % of post-platform-cut remainder that goes to the creator
--   (platform takes 10%, creator gets creator_profit_percent% of the 90% remainder,
--    the rest goes to the prize pool)
-- berry_prize_pool: reserved for future free tournament berry prizes (not used currently)
