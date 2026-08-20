-- Add berry prize pool column to tournaments
-- Used for free tournaments where the prize is in berries (in-app currency)
-- instead of cash (MWK). Max berry prize pool is capped in application logic
-- to the equivalent of MK5,000.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS berry_prize_pool INTEGER DEFAULT 0;

-- Also store the berry distribution alongside the cash prize_distribution
-- We reuse the prize_distribution JSONB column which already stores percentages
-- The same percentage splits apply to both cash and berry prizes
