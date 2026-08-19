-- ============================================================
-- Chess Battles — stake-based head-to-head chess for money
-- ============================================================

-- Battle config (admin-controlled, single row)
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

-- Single row only
INSERT INTO battle_config (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Battle queue — players waiting to be matched
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

-- Battles table
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_battle_queue_stake ON battle_queue(stake_cents, status);
CREATE INDEX IF NOT EXISTS idx_battle_queue_player ON battle_queue(player_id);
CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);
CREATE INDEX IF NOT EXISTS idx_battles_players ON battles(white_player_id, black_player_id);

-- Enable RLS
ALTER TABLE battle_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

-- Policies: anyone authenticated can read config
CREATE POLICY "Anyone can read battle_config" ON battle_config FOR SELECT TO authenticated USING (true);

-- Battle queue: users see their own queue entries
CREATE POLICY "Users read own queue entries" ON battle_queue FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Users insert own queue entries" ON battle_queue FOR INSERT TO authenticated WITH CHECK (player_id = auth.uid());
CREATE POLICY "Users update own queue entries" ON battle_queue FOR UPDATE TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Users delete own queue entries" ON battle_queue FOR DELETE TO authenticated USING (player_id = auth.uid());

-- Battles: players can read their own battles
CREATE POLICY "Players read own battles" ON battles FOR SELECT TO authenticated USING (white_player_id = auth.uid() OR black_player_id = auth.uid());

-- Insert a battle_queue table for tracking locked funds (audit)
CREATE TABLE IF NOT EXISTS battle_escrow (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id       UUID REFERENCES battles(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents    INT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'refunded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at     TIMESTAMPTZ
);

ALTER TABLE battle_escrow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own escrow" ON battle_escrow FOR SELECT TO authenticated USING (player_id = auth.uid());

-- Admin can read all battle tables (via service role, bypasses RLS)

-- ============================================================
-- Wallet helper RPC functions (safety net — may already exist)
-- ============================================================

-- Ensure wallet_balance_cents column exists on profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wallet_balance_cents'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wallet_balance_cents INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Credit wallet
CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id UUID, p_amount_cents INT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET wallet_balance_cents = wallet_balance_cents + p_amount_cents WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Debit wallet (fails if insufficient balance)
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

-- Grant access
GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_wallet(UUID, INT) TO authenticated;
