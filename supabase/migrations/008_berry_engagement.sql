-- ============================================================
-- CRAZYCHESSBERRY — Engagement Earning System
-- Daily login, streaks, sharing, referrals, WhatsApp status
-- ============================================================

-- Expand berry_transactions type constraint to include engagement actions
ALTER TABLE berry_transactions DROP CONSTRAINT IF EXISTS berry_transactions_type_check;
ALTER TABLE berry_transactions ADD CONSTRAINT berry_transactions_type_check
  CHECK (type IN ('earned', 'redeemed', 'adjusted', 'daily_login', 'streak_bonus', 'share_app', 'whatsapp_status', 'referral_signup', 'first_game', 'profile_complete'));

-- Daily login streaks
CREATE TABLE IF NOT EXISTS daily_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_count    INT NOT NULL DEFAULT 1,
  berries_awarded INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own checkins" ON daily_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON daily_checkins(user_id, checkin_date DESC);

-- Referral system
CREATE TABLE IF NOT EXISTS referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code   TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'first_game_played', 'rewarded')),
  berries_awarded INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own referrals" ON referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referred_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id, status);

-- Engagement actions log (track one-time and recurring rewards)
CREATE TABLE IF NOT EXISTS engagement_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('share_app', 'whatsapp_status', 'first_game', 'profile_complete', 'referral_signup')),
  metadata        JSONB,
  berries_awarded INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, action) -- prevents claiming one-time rewards twice
);
ALTER TABLE engagement_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own engagement log" ON engagement_log FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Add referral_code column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referral_code TEXT UNIQUE;
  END IF;
END $$;

-- Auto-generate referral code on profile create
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  username TEXT;
BEGIN
  SELECT username INTO username FROM profiles WHERE id = p_user_id;
  code := COALESCE(left(username, 8), 'player') || '-' || substr(replace(p_user_id::text, '-', ''), 1, 6);
  
  UPDATE profiles SET referral_code = code WHERE id = p_user_id;
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.generate_referral_code(UUID) TO authenticated;

-- Berry earning config (expand existing berry_config with engagement amounts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'berry_config' AND column_name = 'berry_daily_login'
  ) THEN
    ALTER TABLE berry_config ADD COLUMN berry_daily_login INT NOT NULL DEFAULT 5;
    ALTER TABLE berry_config ADD COLUMN berry_streak_3day INT NOT NULL DEFAULT 5;
    ALTER TABLE berry_config ADD COLUMN berry_streak_7day INT NOT NULL DEFAULT 10;
    ALTER TABLE berry_config ADD COLUMN berry_streak_14day INT NOT NULL DEFAULT 20;
    ALTER TABLE berry_config ADD COLUMN berry_streak_30day INT NOT NULL DEFAULT 50;
    ALTER TABLE berry_config ADD COLUMN berry_share_app INT NOT NULL DEFAULT 15;
    ALTER TABLE berry_config ADD COLUMN berry_whatsapp_status INT NOT NULL DEFAULT 20;
    ALTER TABLE berry_config ADD COLUMN berry_referral_signup INT NOT NULL DEFAULT 50;
    ALTER TABLE berry_config ADD COLUMN berry_first_game INT NOT NULL DEFAULT 10;
    ALTER TABLE berry_config ADD COLUMN berry_profile_complete INT NOT NULL DEFAULT 5;
  END IF;
END $$;

-- Done!
