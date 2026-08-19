"use client";

import { useState, useEffect, useCallback } from "react";
import { Cherry, TrendingUp, Plus, Loader2, Check, X, ShoppingCart, Tag } from "lucide-react";

interface Listing {
  id: string;
  amount: number;
  filled_amount: number;
  remaining: number;
  price_cents: number;
  unit_price_cents: number;
  unit_price_formatted: string;
  total_price_formatted: string;
  status: string;
  seller_name: string;
  created_at: string;
}

interface Props {
  berryBalance: number;
  walletBalanceCents: number;
  userId: string;
}

type Tab = "browse" | "sell" | "my-listings";

export default function BerryMarketClient({ berryBalance, walletBalanceCents, userId }: Props) {
  const [tab, setTab] = useState<Tab>("browse");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sell form
  const [sellAmount, setSellAmount] = useState(100);
  const [sellPrice, setSellPrice] = useState(1000); // MWK total
  const [sellLoading, setSellLoading] = useState(false);

  // Buy state
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyAmounts, setBuyAmounts] = useState<Record<string, number>>({});

  // My listings
  const [myListings, setMyListings] = useState<any[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/berry/market/feed?limit=30&sort=price");
      const data = await res.json();
      if (data.listings) setListings(data.listings);
    } catch {
      setError("Failed to load market");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyListings = useCallback(async () => {
    try {
      const res = await fetch("/api/berry/market/feed?limit=50&sort=newest");
      const data = await res.json();
      if (data.listings) {
        setMyListings(data.listings.filter((l: Listing) => l.seller_name === "You"));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (tab === "browse") fetchListings();
    if (tab === "my-listings") fetchMyListings();
  }, [tab, fetchListings, fetchMyListings]);

  const handleSell = async () => {
    setSellLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (sellAmount < 10) {
        setError("Minimum 10 CCB per listing");
        setSellLoading(false);
        return;
      }
      if (sellAmount > berryBalance) {
        setError(`You only have ${berryBalance} CCB`);
        setSellLoading(false);
        return;
      }
      if (sellPrice < 100) {
        setError("Minimum price is MWK 1");
        setSellLoading(false);
        return;
      }

      const res = await fetch("/api/berry/market/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: sellAmount, priceCents: sellPrice * 100 }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to list");
      }

      setSuccess(`Listed ${sellAmount} CCB for MWK ${sellPrice.toLocaleString()}!`);
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSellLoading(false);
    }
  };

  const handleBuy = async (listing: Listing) => {
    setBuyingId(listing.id);
    setError(null);
    setSuccess(null);

    try {
      const buyAmount = buyAmounts[listing.id] || listing.remaining;
      const unitPrice = listing.price_cents / listing.amount;
      const totalCost = Math.round(unitPrice * buyAmount);

      if (totalCost > walletBalanceCents) {
        setError(`Insufficient wallet balance. Need MWK ${Math.floor(totalCost / 100).toLocaleString()}.`);
        setBuyingId(null);
        return;
      }

      const res = await fetch("/api/berry/market/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, amount: buyAmount }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Purchase failed");
      }

      setSuccess(`Bought ${data.bought} CCB for ${data.paidFormatted}! 🍒`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuyingId(null);
    }
  };

  const handleCancel = async (listingId: string) => {
    setCancellingId(listingId);
    setError(null);

    try {
      const res = await fetch("/api/berry/market/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Cancel failed");
      }

      setSuccess(data.message);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const sellUnitPrice = sellAmount > 0 ? (sellPrice / sellAmount).toFixed(1) : "0";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto pb-20 sm:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Cherry className="w-6 h-6 text-red-500" />
          CRAZYCHESSBERRY Market
        </h1>
        <p className="text-sm text-ccb-muted mt-1">
          Buy and sell CCB — the virtual currency of Crazy Chess Battles
        </p>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-gradient-to-br from-red-500/10 to-ccb-surface border-red-500/20 p-4">
          <p className="text-xs text-ccb-muted uppercase tracking-wide flex items-center gap-1">
            <Cherry className="w-3 h-3 text-red-500" /> CCB Balance
          </p>
          <p className="text-2xl font-bold mt-1">{berryBalance.toLocaleString()} 🍒</p>
        </div>
        <div className="card bg-gradient-to-br from-ccb-primary/10 to-ccb-surface border-ccb-primary/20 p-4">
          <p className="text-xs text-ccb-muted uppercase tracking-wide">Wallet</p>
          <p className="text-2xl font-bold mt-1">MWK {Math.floor(walletBalanceCents / 100).toLocaleString()}</p>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 text-green-600 px-4 py-3 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 text-sm flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-ccb-surface rounded-xl">
        <button
          onClick={() => setTab("browse")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            tab === "browse" ? "bg-ccb-primary text-white" : "text-ccb-muted"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Buy
        </button>
        <button
          onClick={() => setTab("sell")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            tab === "sell" ? "bg-ccb-primary text-white" : "text-ccb-muted"
          }`}
        >
          <Plus className="w-4 h-4" />
          Sell
        </button>
        <button
          onClick={() => setTab("my-listings")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            tab === "my-listings" ? "bg-ccb-primary text-white" : "text-ccb-muted"
          }`}
        >
          <Tag className="w-4 h-4" />
          My Orders
        </button>
      </div>

      {/* BROWSE TAB */}
      {tab === "browse" && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-ccb-muted" />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 text-ccb-muted">
              <Cherry className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No active listings yet.</p>
              <p className="text-xs mt-1">Be the first to sell CCB on the market!</p>
            </div>
          ) : (
            listings.map((listing) => {
              const unitPrice = listing.price_cents / listing.amount;
              const buyAmount = buyAmounts[listing.id] || listing.remaining;
              const totalCost = Math.round(unitPrice * buyAmount);

              return (
                <div key={listing.id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{listing.remaining.toLocaleString()} 🍒</span>
                        {listing.status === "partial" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600">
                            Partial — {listing.filled_amount} sold
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ccb-muted mt-0.5">
                        by {listing.seller_name} • {listing.unit_price_formatted}/berry
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">MWK {Math.floor(listing.price_cents / 100).toLocaleString()}</p>
                      <p className="text-xs text-ccb-muted">total ask</p>
                    </div>
                  </div>

                  {listing.remaining > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ccb-muted">Buy:</span>
                      <input
                        type="number"
                        value={buyAmount}
                        onChange={(e) =>
                          setBuyAmounts({ ...buyAmounts, [listing.id]: Math.min(listing.remaining, Math.max(1, parseInt(e.target.value) || 1)) })
                        }
                        min={1}
                        max={listing.remaining}
                        className="w-24 px-2 py-1.5 rounded-lg bg-ccb-surface border border-ccb-border text-sm"
                      />
                      <span className="text-xs text-ccb-muted">= MWK {Math.floor(totalCost / 100).toLocaleString()}</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleBuy(listing)}
                    disabled={buyingId === listing.id || totalCost > walletBalanceCents}
                    className="w-full py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {buyingId === listing.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Buy {buyAmount.toLocaleString()} CCB for MWK {Math.floor(totalCost / 100).toLocaleString()}
                      </>
                    )}
                  </button>
                  {totalCost > walletBalanceCents && (
                    <p className="text-xs text-red-500 text-center">Insufficient wallet balance</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SELL TAB */}
      {tab === "sell" && (
        <div className="space-y-4 card p-5">
          <div>
            <label className="text-sm font-medium text-ccb-muted mb-2 block">Amount (CCB)</label>
            <input
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(Math.max(10, parseInt(e.target.value) || 0))}
              min={10}
              max={berryBalance}
              className="w-full px-4 py-3 rounded-xl bg-ccb-surface border border-ccb-border text-lg font-semibold"
            />
            <p className="text-xs text-ccb-muted mt-1">Available: {berryBalance.toLocaleString()} CCB</p>
          </div>

          <div>
            <label className="text-sm font-medium text-ccb-muted mb-2 block">Total Price (MWK)</label>
            <input
              type="number"
              value={sellPrice}
              onChange={(e) => setSellPrice(Math.max(1, parseInt(e.target.value) || 0))}
              min={1}
              className="w-full px-4 py-3 rounded-xl bg-ccb-surface border border-ccb-border text-lg font-semibold"
            />
            <p className="text-xs text-ccb-muted mt-1">
              Price per berry: MWK {sellUnitPrice} • 
              You earn MWK <span className="font-medium">{sellPrice.toLocaleString()}</span> when sold
            </p>
          </div>

          {/* Quick price suggestions */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Cheap", amount: 100, price: 500 },
              { label: "Fair", amount: 100, price: 1000 },
              { label: "Premium", amount: 100, price: 2000 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => { setSellAmount(preset.amount); setSellPrice(preset.price); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-ccb-surface border border-ccb-border hover:border-ccb-primary"
              >
                {preset.label}: {preset.amount} CCB = MWK {preset.price.toLocaleString()}
              </button>
            ))}
          </div>

          <button
            onClick={handleSell}
            disabled={sellLoading || sellAmount > berryBalance || sellAmount < 10}
            className="w-full py-3.5 rounded-xl bg-red-500 text-white font-semibold flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50"
          >
            {sellLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Plus className="w-5 h-5" />
                List {sellAmount} CCB for MWK {sellPrice.toLocaleString()}
              </>
            )}
          </button>

          <p className="text-xs text-ccb-muted">
            Your CCB is locked when you list it. You can cancel anytime to reclaim unsold berries.
            Wallet balance: MWK {Math.floor(walletBalanceCents / 100).toLocaleString()}.
          </p>
        </div>
      )}

      {/* MY LISTINGS TAB */}
      {tab === "my-listings" && (
        <div className="space-y-3">
          {myListings.length === 0 ? (
            <div className="text-center py-12 text-ccb-muted">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">You have no active listings.</p>
              <p className="text-xs mt-1">Go to Sell to create one.</p>
            </div>
          ) : (
            myListings.map((listing) => (
              <div key={listing.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold">{listing.remaining?.toLocaleString() || listing.amount} 🍒</p>
                    <p className="text-xs text-ccb-muted">
                      MWK {Math.floor(listing.price_cents / 100).toLocaleString()} total •
                      {listing.unit_price_formatted}/berry
                    </p>
                    <p className="text-xs text-ccb-muted mt-1">
                      {listing.status === "partial" ? `${listing.filled_amount} sold` : listing.status}
                    </p>
                  </div>
                  {listing.status === "active" || listing.status === "partial" ? (
                    <button
                      onClick={() => handleCancel(listing.id)}
                      disabled={cancellingId === listing.id}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    >
                      {cancellingId === listing.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel & Refund"}
                    </button>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-ccb-surface text-ccb-muted">{listing.status}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
