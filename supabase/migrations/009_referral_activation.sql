-- ============================================================
-- Referral System Update + Remove Berry Market
-- ============================================================

-- 1. Bump referral reward from 50 to 1000 berries (= MK500 at 0.5 MWK/berry)
UPDATE berry_config SET berry_referral_signup = 1000, updated_at = now();

-- 2. Add activation tracking to referrals table
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE referrals ADD CONSTRAINT referrals_status_check
  CHECK (status IN ('pending', 'signed_up', 'activated', 'rewarded'));

-- Add columns to track activation conditions
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS activation_condition TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS quick_matches_played INT NOT NULL DEFAULT 0;

-- 3. Drop the berry market tables (berries are in-app only, no P2P market)
DROP TABLE IF EXISTS berry_market_trades CASCADE;
DROP TABLE IF EXISTS berry_market_listings CASCADE;

-- 4. Function to check and trigger referral activation
CREATE OR REPLACE FUNCTION public.check_referral_activation(
  p_user_id UUID,
  p_action TEXT
)
RETURNS VOID AS $$
DECLARE
  v_referral RECORD;
  v_should_activate BOOLEAN := false;
  v_condition TEXT;
BEGIN
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = p_user_id AND status IN ('pending', 'signed_up');
  
  IF NOT FOUND THEN RETURN; END IF;
  IF v_referral.status IN ('activated', 'rewarded') THEN RETURN; END IF;
  
  CASE p_action
    WHEN 'battle' THEN
      v_should_activate := true;
      v_condition := 'chess_battle';
    WHEN 'tournament' THEN
      v_should_activate := true;
      v_condition := 'tournament_joined';
    WHEN 'wallet_topup' THEN
      v_should_activate := true;
      v_condition := 'wallet_topup';
    WHEN 'quick_match' THEN
      UPDATE referrals SET quick_matches_played = quick_matches_played + 1 WHERE id = v_referral.id;
      SELECT quick_matches_played >= 10 INTO v_should_activate FROM referrals WHERE id = v_referral.id;
      v_condition := '10_quick_matches';
    ELSE
      RETURN;
  END CASE;
  
  IF v_should_activate THEN
    UPDATE referrals
    SET status = 'rewarded', activation_condition = v_condition,
        activated_at = now(), completed_at = now(), berries_awarded = 1000
    WHERE id = v_referral.id;
    
    PERFORM public.credit_berries(v_referral.referrer_id, 1000, NULL, 'Referral reward');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.check_referral_activation(UUID, TEXT) TO authenticated;
