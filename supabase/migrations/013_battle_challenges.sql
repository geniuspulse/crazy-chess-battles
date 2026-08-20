-- ============================================================
-- 013: Friendly challenges (fix pre-existing missing table) +
--      Stake-based battle challenges (challenge a friend to a battle)
-- ============================================================

-- ---- Friendly challenges (no stake, casual/ranked game link) ----
-- This table was referenced by /api/challenge/create and /api/challenge/accept
-- but never had a migration — the "Challenge a Friend" feature on /play was
-- silently failing. Creating it here fixes that.
CREATE TABLE IF NOT EXISTS challenges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acceptor_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  time_control      TEXT NOT NULL,
  initial_minutes   INT NOT NULL,
  increment_seconds INT NOT NULL DEFAULT 0,
  rated             BOOLEAN NOT NULL DEFAULT true,
  color             TEXT NOT NULL DEFAULT 'random',
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  game_id           UUID REFERENCES games(id),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or pending challenges" ON challenges
  FOR SELECT TO authenticated
  USING (challenger_id = auth.uid() OR acceptor_id = auth.uid() OR status = 'pending');
CREATE POLICY "Create own challenges" ON challenges
  FOR INSERT TO authenticated WITH CHECK (challenger_id = auth.uid());
CREATE POLICY "Challenger updates own challenge" ON challenges
  FOR UPDATE TO authenticated USING (challenger_id = auth.uid());

-- ---- Stake-based battle challenges (Challenge a Friend, from Battles page) ----
CREATE TABLE IF NOT EXISTS battle_challenges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acceptor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stake_cents    INT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  battle_id      UUID REFERENCES battles(id),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battle_challenges_challenger ON battle_challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_battle_challenges_status ON battle_challenges(status);

ALTER TABLE battle_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or pending battle challenges" ON battle_challenges
  FOR SELECT TO authenticated
  USING (challenger_id = auth.uid() OR acceptor_id = auth.uid() OR status = 'pending');
CREATE POLICY "Create own battle challenges" ON battle_challenges
  FOR INSERT TO authenticated WITH CHECK (challenger_id = auth.uid());
CREATE POLICY "Challenger updates own battle challenge" ON battle_challenges
  FOR UPDATE TO authenticated USING (challenger_id = auth.uid());
