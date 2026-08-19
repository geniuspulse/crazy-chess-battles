-- ============================================================
-- CRAZYCHESSBERRY — P2P Berry Market
-- ============================================================

-- Update min_redemption to 1000
UPDATE berry_config SET min_redemption = 1000, updated_at = now();

-- Berry market listings (sell orders)
CREATE TABLE IF NOT EXISTS berry_market_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          INT NOT NULL CHECK (amount > 0),          -- berries being sold
  price_cents     INT NOT NULL CHECK (price_cents > 0),      -- seller's asking price in MWK cents
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'partial')),
  filled_amount   INT NOT NULL DEFAULT 0,                    -- how many berries sold so far
  buyer_id        UUID REFERENCES auth.users(id),            -- who bought (for single-buy listings)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

ALTER TABLE berry_market_listings ENABLE ROW LEVEL SECURITY;
-- Everyone can see active listings (it's a public market)
CREATE POLICY "Anyone can read active listings" ON berry_market_listings FOR SELECT TO authenticated USING (true);
-- Sellers can insert their own listings
CREATE POLICY "Users create own listings" ON berry_market_listings FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
-- Sellers can update/cancel their own listings
CREATE POLICY "Sellers update own listings" ON berry_market_listings FOR UPDATE TO authenticated USING (seller_id = auth.uid());
-- Sellers can delete their own listings (if still active)
CREATE POLICY "Sellers delete own listings" ON berry_market_listings FOR DELETE TO authenticated USING (seller_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_berry_listings_active ON berry_market_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_berry_listings_seller ON berry_market_listings(seller_id, status);

-- Berry market trades (completed transactions)
CREATE TABLE IF NOT EXISTS berry_market_trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID NOT NULL REFERENCES berry_market_listings(id) ON DELETE CASCADE,
  seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          INT NOT NULL CHECK (amount > 0),           -- berries traded
  price_cents     INT NOT NULL CHECK (price_cents > 0),      -- total price paid
  unit_price_cents INT NOT NULL CHECK (unit_price_cents > 0), -- price per berry
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE berry_market_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read trades" ON berry_market_trades FOR SELECT TO authenticated USING (seller_id = auth.uid() OR buyer_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_berry_trades_buyer ON berry_market_trades(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_berry_trades_seller ON berry_market_trades(seller_id, created_at DESC);

-- Function to execute a berry market trade atomically
CREATE OR REPLACE FUNCTION public.execute_berry_trade(
  p_listing_id   UUID,
  p_buyer_id     UUID,
  p_buy_amount   INT DEFAULT NULL   -- NULL = buy entire listing
)
RETURNS JSONB AS $$
DECLARE
  listing     RECORD;
  buy_amount  INT;
  total_cents INT;
  unit_price  INT;
  seller_bal  INT;
  buyer_bal   INT;
  new_seller_bal INT;
  new_buyer_bal  INT;
BEGIN
  -- Lock the listing
  SELECT * INTO listing FROM berry_market_listings
  WHERE id = p_listing_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Listing not found or not active');
  END IF;

  IF listing.seller_id = p_buyer_id THEN
    RETURN jsonb_build_object('error', 'Cannot buy your own listing');
  END IF;

  -- Determine buy amount
  buy_amount := COALESCE(p_buy_amount, listing.amount - listing.filled_amount);
  buy_amount := LEAST(buy_amount, listing.amount - listing.filled_amount);

  IF buy_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Listing is fully filled');
  END IF;

  -- Calculate price
  unit_price := listing.price_cents / listing.amount;  -- price per berry in cents
  total_cents := unit_price * buy_amount;

  -- Check buyer has enough wallet balance
  SELECT wallet_balance_cents INTO buyer_bal FROM profiles WHERE id = p_buyer_id FOR UPDATE;
  IF buyer_bal < total_cents THEN
    RETURN jsonb_build_object('error', 'Insufficient wallet balance');
  END IF;

  -- Check seller has enough berries
  SELECT berry_balance INTO seller_bal FROM profiles WHERE id = listing.seller_id FOR UPDATE;
  IF seller_bal < buy_amount THEN
    RETURN jsonb_build_object('error', 'Seller has insufficient berries');
  END IF;

  -- Execute: debit buyer wallet
  UPDATE profiles SET wallet_balance_cents = wallet_balance_cents - total_cents WHERE id = p_buyer_id
  RETURNING wallet_balance_cents INTO new_buyer_bal;

  -- Credit seller wallet
  UPDATE profiles SET wallet_balance_cents = wallet_balance_cents + total_cents WHERE id = listing.seller_id;

  -- Debit seller berries
  UPDATE profiles SET berry_balance = berry_balance - buy_amount WHERE id = listing.seller_id
  RETURNING berry_balance INTO new_seller_bal;

  -- Credit buyer berries
  UPDATE profiles SET berry_balance = berry_balance + buy_amount WHERE id = p_buyer_id;

  -- Log transactions
  INSERT INTO berry_transactions (user_id, type, amount, balance_after, description)
  VALUES (listing.seller_id, 'redeemed', -buy_amount, new_seller_bal, 
    'Sold ' || buy_amount || ' CCB on market for MWK ' || (total_cents / 100));

  INSERT INTO berry_transactions (user_id, type, amount, balance_after, description)
  VALUES (p_buyer_id, 'earned', buy_amount, 
    (SELECT berry_balance FROM profiles WHERE id = p_buyer_id),
    'Bought ' || buy_amount || ' CCB on market for MWK ' || (total_cents / 100));

  -- Record trade
  INSERT INTO berry_market_trades (listing_id, seller_id, buyer_id, amount, price_cents, unit_price_cents)
  VALUES (p_listing_id, listing.seller_id, p_buyer_id, buy_amount, total_cents, unit_price);

  -- Update listing
  IF listing.filled_amount + buy_amount >= listing.amount THEN
    UPDATE berry_market_listings SET 
      status = 'sold', 
      filled_amount = listing.amount,
      buyer_id = p_buyer_id,
      completed_at = now()
    WHERE id = p_listing_id;
  ELSE
    UPDATE berry_market_listings SET 
      filled_amount = filled_amount + buy_amount,
      status = 'partial'
    WHERE id = p_listing_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'amount', buy_amount,
    'price_cents', total_cents,
    'buyer_balance', new_buyer_bal,
    'buyer_berries', (SELECT berry_balance FROM profiles WHERE id = p_buyer_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.execute_berry_trade(UUID, UUID, INT) TO authenticated;
