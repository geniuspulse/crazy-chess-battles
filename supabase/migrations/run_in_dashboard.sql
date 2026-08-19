-- ============================================================
-- Crazy Chess Battles — Full Migration (includes Berry System)
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times — everything uses IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1. Battle tables
-- ============================================================

CREATE TABLE IF NOT EXISTS battle_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  stake_levels     JSONB NOT NULL DEFAULT '[50000, 100000, 250000, 500000, 1000000]'::jsonb,
  platform_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  rating_range     INT NOT NULL DEFAULT 200,
  queue_timeout_s  INT NOT NULL DEFAULT 120,
  initial_minutes  INT NOT NULL DEFAULT 5,
  increment_seconds INT NOT NULL DEFAULT 2,
  armageddon_pct   INT NOT NULL DEFAULT 50,
  max_armageddon_rounds INT NOT NULL DEFAULT 3,
  disconnect_timeout_s INT NOT NULL DEFAULT 30,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO battle_config (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS battle_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake_cents     INT NOT NULL,
  rating          INT NOT NULL DEFAULT 1200,
  status          TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'expired', 'left')),
  battle_id       UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_at      TIMESTAMPTZ,
  UNIQUE (player_id, stake_cents, status)
);

CREATE TABLE IF NOT EXISTS battles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  black_player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake_cents     INT NOT NULL,
  pot_cents       INT NOT NULL,
  platform_fee_cents INT NOT NULL DEFAULT 0,
  winner_payout_cents INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'completed', 'draw_armageddon', 'cancelled', 'disputed')),
  game_id         UUID REFERENCES games(id),
  armageddon_game_id UUID REFERENCES games(id),
  armageddon_round INT NOT NULL DEFAULT 0,
  winner_id       UUID REFERENCES auth.users(id),
  result          TEXT,
  white_rating    INT,
  black_rating    INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  settled         BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_battle_queue_stake ON battle_queue(stake_cents, status);
CREATE INDEX IF NOT EXISTS idx_battle_queue_player ON battle_queue(player_id);
CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);
CREATE INDEX IF NOT EXISTS idx_battles_players ON battles(white_player_id, black_player_id);

ALTER TABLE battle_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read battle_config" ON battle_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users read own queue entries" ON battle_queue FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Users insert own queue entries" ON battle_queue FOR INSERT TO authenticated WITH CHECK (player_id = auth.uid());
CREATE POLICY "Users update own queue entries" ON battle_queue FOR UPDATE TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Users delete own queue entries" ON battle_queue FOR DELETE TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Players read own battles" ON battles FOR SELECT TO authenticated USING (white_player_id = auth.uid() OR black_player_id = auth.uid());

CREATE TABLE IF NOT EXISTS battle_escrow (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id       UUID REFERENCES battles(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents    INT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'refunded')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at     TIMESTAMPTZ
);
ALTER TABLE battle_escrow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own escrow" ON battle_escrow FOR SELECT TO authenticated USING (player_id = auth.uid());

-- ============================================================
-- 2. Wallet functions
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wallet_balance_cents'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wallet_balance_cents INT NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id UUID, p_amount_cents INT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET wallet_balance_cents = wallet_balance_cents + p_amount_cents WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.debit_wallet(p_user_id UUID, p_amount_cents INT)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND wallet_balance_cents >= p_amount_cents
  ) THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  UPDATE profiles SET wallet_balance_cents = wallet_balance_cents - p_amount_cents WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_wallet(UUID, INT) TO authenticated;

-- ============================================================
-- 3. Withdrawals table
-- ============================================================

CREATE TABLE IF NOT EXISTS withdrawals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents    INT NOT NULL,
  phone           TEXT NOT NULL,
  operator_name   TEXT NOT NULL,
  operator_ref_id TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed')),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own withdrawals" ON withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own withdrawals" ON withdrawals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all withdrawals" ON withdrawals FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins update all withdrawals" ON withdrawals FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ============================================================
-- 4. chess_level column on profiles
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'chess_level'
  ) THEN
    ALTER TABLE profiles ADD COLUMN chess_level TEXT DEFAULT 'beginner';
  END IF;
END $$;

-- ============================================================
-- 5. game_chat table
-- ============================================================

CREATE TABLE IF NOT EXISTS game_chat (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE game_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can read game chat" ON game_chat FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM games WHERE id = game_id AND (white_player = auth.uid() OR black_player = auth.uid()))
);
CREATE POLICY "Players can send game chat" ON game_chat FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM games WHERE id = game_id AND (white_player = auth.uid() OR black_player = auth.uid()))
);
CREATE INDEX IF NOT EXISTS idx_game_chat_game ON game_chat(game_id, created_at);

-- ============================================================
-- 6. Berry System — earn berries from quick match wins, redeem for cash
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
  amount          INT NOT NULL,
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
  berry_value_cents INT NOT NULL DEFAULT 1000,
  min_redemption    INT NOT NULL DEFAULT 50,
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

-- Done! All tables created.
