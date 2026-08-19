-- ============================================================
-- Berry System — earn berries from quick match wins, redeem for cash
-- ============================================================

-- Add berry_balance column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'berry_balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN berry_balance INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Berry transactions log
CREATE TABLE IF NOT EXISTS berry_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'adjusted')),
  amount          INT NOT NULL,  -- positive for earned, negative for redeemed
  balance_after   INT NOT NULL,
  game_id         UUID REFERENCES games(id) ON DELETE SET NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE berry_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own berry transactions" ON berry_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_berry_tx_user ON berry_transactions(user_id, created_at DESC);

-- Berry config (admin-controlled)
CREATE TABLE IF NOT EXISTS berry_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  berries_per_win   INT NOT NULL DEFAULT 10,
  berries_per_draw  INT NOT NULL DEFAULT 2,
  berry_value_cents INT NOT NULL DEFAULT 1000,  -- MWK per 100 berries
  min_redemption    INT NOT NULL DEFAULT 50,    -- minimum berries to redeem
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO berry_config (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;
ALTER TABLE berry_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read berry_config" ON berry_config FOR SELECT TO authenticated USING (true);

-- Credit berries function
CREATE OR REPLACE FUNCTION public.credit_berries(p_user_id UUID, p_amount INT, p_game_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  new_balance INT;
BEGIN
  UPDATE profiles SET berry_balance = berry_balance + p_amount WHERE id = p_user_id
  RETURNING berry_balance INTO new_balance;
  
  INSERT INTO berry_transactions (user_id, type, amount, balance_after, game_id, description)
  VALUES (p_user_id, 'earned', p_amount, new_balance, p_game_id, p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Debit berries (for redemption)
CREATE OR REPLACE FUNCTION public.debit_berries(p_user_id UUID, p_amount INT, p_description TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  new_balance INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND berry_balance >= p_amount
  ) THEN
    RAISE EXCEPTION 'Insufficient berries';
  END IF;
  
  UPDATE profiles SET berry_balance = berry_balance - p_amount WHERE id = p_user_id
  RETURNING berry_balance INTO new_balance;
  
  INSERT INTO berry_transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'redeemed', -p_amount, new_balance, p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.credit_berries(UUID, INT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_berries(UUID, INT, TEXT) TO authenticated;
