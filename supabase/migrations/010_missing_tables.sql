-- ============================================================
-- Migration 010: Missing tables & RPCs
-- Fixes: deposits table, request_withdrawal RPC, RLS policies
-- ============================================================

-- ============================================================
-- 1. DEPOSITS TABLE (referenced in 8+ files but never created)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deposits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents    INT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  method          TEXT NOT NULL,
  charge_id       TEXT,
  tx_ref          TEXT,
  paychangu_ref   TEXT,
  phone           TEXT,
  operator        TEXT,
  reference       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposits_user ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_charge_id ON public.deposits(charge_id);
CREATE INDEX IF NOT EXISTS idx_deposits_tx_ref ON public.deposits(tx_ref);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON public.deposits(created_at DESC);

-- RLS: users see their own deposits, admins see all
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own deposits" ON public.deposits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own deposits" ON public.deposits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all deposits" ON public.deposits FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ============================================================
-- 2. REQUEST_WITHDRAWAL RPC (called by withdrawals/request route)
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_id        UUID,
  p_amount_cents   INT,
  p_phone          TEXT,
  p_operator_ref_id TEXT,
  p_operator_name  TEXT
)
RETURNS UUID AS $$
DECLARE
  withdrawal_id UUID;
  current_balance INT;
BEGIN
  -- Check sufficient balance
  SELECT wallet_balance_cents INTO current_balance
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF current_balance < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Debit wallet
  UPDATE public.profiles
  SET wallet_balance_cents = wallet_balance_cents - p_amount_cents,
      updated_at = now()
  WHERE id = p_user_id;

  -- Create withdrawal record
  INSERT INTO public.withdrawals (user_id, amount_cents, phone, operator_name, operator_ref_id, status)
  VALUES (p_user_id, p_amount_cents, p_phone, p_operator_name, p_operator_ref_id, 'pending')
  RETURNING id INTO withdrawal_id;

  RETURN withdrawal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(UUID, INT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 3. Ensure updated_at trigger on deposits
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deposits_updated_at ON public.deposits;
CREATE TRIGGER deposits_updated_at
  BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
