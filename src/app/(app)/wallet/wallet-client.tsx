"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet, Smartphone, CreditCard, Check, Loader2, ArrowDown, ArrowUp, Clock, Cherry, ExternalLink, Gift } from "lucide-react";
import Link from "next/link";

interface Deposit {
  id: string;
  amount_cents: number;
  method: string;
  status: string;
  created_at: string;
  charge_id: string | null;
}

interface Withdrawal {
  id: string;
  amount_cents: number;
  phone: string;
  operator_name: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface WalletClientProps {
  balanceCents: number;
  berryBalance: number;
  email: string;
  deposits: Deposit[];
  phone?: string | null;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];
const BERRY_VALUE_CENTS = 1000; // 100 berries = MWK 1,000
const MIN_REDEEM_BERRIES = 1000;

const OPERATORS = [
  { id: "27494cb5-ba9e-437f-a114-4e7a7686bcca", name: "TNM Mpamba", color: "bg-blue-500" },
  { id: "20be6c20-adeb-4b5b-a7ba-0769820df4fb", name: "Airtel Money", color: "bg-red-500" },
];

export default function WalletClient({ balanceCents, berryBalance, email, deposits, phone: savedPhone }: WalletClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState(1000);
  const [method, setMethod] = useState<"mobile_money" | "card">("mobile_money");
  const [phone, setPhone] = useState(savedPhone || "");
  const [operator, setOperator] = useState(OPERATORS[0].id);
  const [operators, setOperators] = useState(OPERATORS);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingChargeId, setPendingChargeId] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState(1000);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [berries, setBerries] = useState(berryBalance);

  useEffect(() => {
    fetch("/api/payments/operators")
      .then((res) => res.json())
      .then((data) => {
        if (data.data && Array.isArray(data.data)) {
          const mapped = data.data.map((op: any) => ({
            id: op.ref_id || op.id,
            name: op.name || op.operator_name,
            color: op.name?.toLowerCase().includes("tnm") ? "bg-blue-500" : "bg-red-500",
          }));
          if (mapped.length > 0) {
            setOperators(mapped);
            setOperator(mapped[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/withdrawals/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.withdrawals) setWithdrawals(data.withdrawals);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const txRef = searchParams.get("tx_ref");
    if (txRef) {
      setPolling(true);
      const interval = setInterval(async () => {
        try {
          const res = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chargeId: txRef }),
          });
          const data = await res.json();
          if (data.status === "success") {
            setSuccess(`MWK ${Math.floor(data.amount / 100).toLocaleString()} added to your wallet!`);
            setPolling(false);
            clearInterval(interval);
            router.refresh();
          } else if (data.status === "failed") {
            setError("Payment failed. Please try again.");
            setPolling(false);
            clearInterval(interval);
          }
        } catch {}
      }, 3000);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        setPolling(false);
      }, 120000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!pendingChargeId) return;

    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chargeId: pendingChargeId }),
        });
        const data = await res.json();

        if (data.status === "success") {
          setSuccess(`MWK ${Math.floor(data.amount / 100).toLocaleString()} added to your wallet!`);
          setPolling(false);
          setPendingChargeId(null);
          clearInterval(interval);
          router.refresh();
        } else if (data.status === "failed") {
          setError("Payment failed or timed out. Please try again.");
          setPolling(false);
          setPendingChargeId(null);
          clearInterval(interval);
        }
      } catch {}
    }, 5000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
      if (pendingChargeId) {
        setError("Payment verification timed out. If you completed the payment, your balance will update shortly.");
        setPendingChargeId(null);
      }
    }, 180000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pendingChargeId, router]);

  const handleDeposit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (method === "mobile_money") {
        if (!phone || phone.length < 9) {
          setError("Enter a valid phone number (e.g., 0991234567)");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/payments/deposit/mobile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents: amount * 100,
            phone,
            operatorRefId: operator,
            email,
          }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || "Payment failed. Please try again.");
        }

        setPendingChargeId(data.chargeId);
        setSuccess("Check your phone to authorize the payment. Waiting for confirmation...");
      } else {
        const res = await fetch("/api/payments/deposit/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents: amount * 100, email }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || "Payment failed. Please try again.");
        }

        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      }
    } catch (err: any) {
      setError(err.message && err.message.length < 200 ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!phone || phone.length < 9) {
        setError("Enter a valid phone number");
        setWithdrawLoading(false);
        return;
      }
      if (amount * 100 > balanceCents) {
        setError("Insufficient balance");
        setWithdrawLoading(false);
        return;
      }

      const opName = operators.find((o) => o.id === operator)?.name || "Mobile Money";

      const res = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: amount * 100,
          phone,
          operatorRefId: operator,
          operatorName: opName,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Withdrawal failed. Please try again.");
      }

      setSuccess(`Withdrawal request for MWK ${amount.toLocaleString()} submitted. You'll receive it within 24 hours after admin approval.`);
      router.refresh();

      fetch("/api/withdrawals/list")
        .then((r) => r.json())
        .then((d) => { if (d.withdrawals) setWithdrawals(d.withdrawals); });
    } catch (err: any) {
      setError(err.message && err.message.length < 200 ? err.message : "Something went wrong. Please try again.");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleRedeemBerries = async () => {
    setRedeemLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (redeemAmount < MIN_REDEEM_BERRIES) {
        setError(`Minimum redemption is ${MIN_REDEEM_BERRIES} berries`);
        setRedeemLoading(false);
        return;
      }
      if (redeemAmount > berries) {
        setError(`You only have ${berries} berries`);
        setRedeemLoading(false);
        return;
      }

      const res = await fetch("/api/berry/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ berries: redeemAmount }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Redemption failed");
      }

      setBerries(data.newBerryBalance);
      setSuccess(`Redeemed ${data.berriesRedeemed} berries for ${data.cashFormatted}! Added to your wallet.`);
      router.refresh();
    } catch (err: any) {
      setError(err.message && err.message.length < 200 ? err.message : "Redemption failed");
    } finally {
      setRedeemLoading(false);
    }
  };

  const redeemCashValue = Math.round((redeemAmount / 100) * BERRY_VALUE_CENTS);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto pb-20 sm:pb-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-ccb-primary" />
          Wallet
        </h1>
        <p className="text-sm text-ccb-muted mt-1">Deposit, withdraw, and manage your funds</p>
      </div>

      {/* Balance Card */}
      <div className="card bg-gradient-to-br from-ccb-primary/10 to-ccb-surface border-ccb-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ccb-muted uppercase tracking-wide">Wallet Balance</p>
            <p className="text-3xl font-bold mt-1">MWK {Math.floor(balanceCents / 100).toLocaleString()}</p>
          </div>
          <div className="w-14 h-14 rounded-full bg-ccb-primary/10 flex items-center justify-center">
            <Wallet className="w-7 h-7 text-ccb-primary" />
          </div>
        </div>
      </div>

      {/* Berry Card */}
      <div className="card bg-gradient-to-br from-red-500/10 to-ccb-surface border-red-500/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-ccb-muted uppercase tracking-wide flex items-center gap-1">
              <Cherry className="w-3.5 h-3.5 text-red-500" />
              Berry Balance
            </p>
            <p className="text-3xl font-bold mt-1">{berries.toLocaleString()} 🍒</p>
            <p className="text-xs text-ccb-muted mt-1">
              Win quick matches to earn CCB • Redeem at 1000+ or sell on the market
            </p>
          </div>
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <Cherry className="w-7 h-7 text-red-500" />
          </div>
        </div>

        {/* Redeem section */}
        {berries >= MIN_REDEEM_BERRIES && (
          <div className="mt-3 pt-3 border-t border-red-500/10">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(Math.max(0, parseInt(e.target.value) || 0))}
                min={MIN_REDEEM_BERRIES}
                max={berries}
                step={10}
                className="flex-1 px-3 py-2 rounded-lg bg-ccb-surface border border-ccb-border text-sm"
                placeholder="Berries to redeem"
              />
              <button
                onClick={handleRedeemBerries}
                disabled={redeemLoading || redeemAmount < MIN_REDEEM_BERRIES || redeemAmount > berries}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {redeemLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Redeem
              </button>
            </div>
            <p className="text-xs text-ccb-muted">
              = MWK {Math.floor(redeemCashValue / 100).toLocaleString()} to wallet
            </p>
          </div>
        )}

        {berries < MIN_REDEEM_BERRIES && (
          <div className="text-xs text-ccb-muted mt-2 pt-2 border-t border-red-500/10">
            <p>Win {MIN_REDEEM_BERRIES - berries} more CCB to unlock cash redemption</p>
          </div>
        )}

        {/* Referral bonus */}
        <div className="mt-3 pt-3 border-t border-red-500/10">
          <Link
            href="/earn"
            className="flex items-center justify-between text-sm text-ccb-primary font-medium hover:opacity-80"
          >
            <span className="flex items-center gap-1">
              <Gift className="w-3.5 h-3.5" />
              Earn more CCB 🍒
            </span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="rounded-lg bg-ccb-success/10 border border-ccb-success/30 text-ccb-success px-4 py-3 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-ccb-surface rounded-xl">
        <button
          onClick={() => setTab("deposit")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            tab === "deposit" ? "bg-ccb-primary text-white" : "text-ccb-muted"
          }`}
        >
          <ArrowDown className="w-4 h-4" />
          Deposit
        </button>
        <button
          onClick={() => setTab("withdraw")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            tab === "withdraw" ? "bg-ccb-primary text-white" : "text-ccb-muted"
          }`}
        >
          <ArrowUp className="w-4 h-4" />
          Withdraw
        </button>
      </div>

      {tab === "deposit" ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ccb-muted mb-2 block">Amount (MWK)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(100, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-3 rounded-xl bg-ccb-surface border border-ccb-border text-lg font-semibold"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    amount === amt ? "bg-ccb-primary text-white" : "bg-ccb-surface text-ccb-muted border border-ccb-border"
                  }`}
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-ccb-muted mb-2 block">Payment Method</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMethod("mobile_money")}
                className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition-colors ${
                  method === "mobile_money" ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary" : "border-ccb-border text-ccb-muted"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Mobile Money
              </button>
              <button
                onClick={() => setMethod("card")}
                className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition-colors ${
                  method === "card" ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary" : "border-ccb-border text-ccb-muted"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Card
              </button>
            </div>
          </div>

          {method === "mobile_money" && (
            <>
              <div>
                <label className="text-sm font-medium text-ccb-muted mb-2 block">Operator</label>
                <div className="flex gap-2">
                  {operators.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => setOperator(op.id)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        operator === op.id ? "border-ccb-primary bg-ccb-primary/10" : "border-ccb-border"
                      }`}
                    >
                      {op.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-ccb-muted mb-2 block">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0991234567"
                  className="w-full px-4 py-3 rounded-xl bg-ccb-surface border border-ccb-border"
                />
              </div>
            </>
          )}

          <button
            onClick={handleDeposit}
            disabled={loading || polling}
            className="w-full py-3.5 rounded-xl bg-ccb-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-ccb-primary/90 disabled:opacity-50"
          >
            {loading || polling ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {polling ? "Waiting for payment..." : "Processing..."}
              </>
            ) : (
              <>Deposit MWK {amount.toLocaleString()}</>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ccb-muted mb-2 block">Amount (MWK)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(100, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-3 rounded-xl bg-ccb-surface border border-ccb-border text-lg font-semibold"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    amount === amt ? "bg-ccb-primary text-white" : "bg-ccb-surface text-ccb-muted border border-ccb-border"
                  }`}
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-ccb-muted mb-2 block">Operator</label>
            <div className="flex gap-2">
              {operators.map((op) => (
                <button
                  key={op.id}
                  onClick={() => setOperator(op.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    operator === op.id ? "border-ccb-primary bg-ccb-primary/10" : "border-ccb-border"
                  }`}
                >
                  {op.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-ccb-muted mb-2 block">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0991234567"
              className="w-full px-4 py-3 rounded-xl bg-ccb-surface border border-ccb-border"
            />
          </div>

          <button
            onClick={handleWithdraw}
            disabled={withdrawLoading}
            className="w-full py-3.5 rounded-xl bg-ccb-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-ccb-primary/90 disabled:opacity-50"
          >
            {withdrawLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>Withdraw MWK {amount.toLocaleString()}</>
            )}
          </button>

          {withdrawals.length > 0 && (
            <div>
              <p className="text-sm font-medium text-ccb-muted mb-2">Withdrawal History</p>
              <div className="space-y-2">
                {withdrawals.slice(0, 5).map((w) => (
                  <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-ccb-surface border border-ccb-border">
                    <div>
                      <p className="text-sm font-medium">MWK {Math.floor(w.amount_cents / 100).toLocaleString()}</p>
                      <p className="text-xs text-ccb-muted">{w.operator_name} • {new Date(w.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      w.status === "completed" ? "bg-green-500/10 text-green-600" :
                      w.status === "pending" ? "bg-yellow-500/10 text-yellow-600" :
                      w.status === "approved" ? "bg-blue-500/10 text-blue-600" :
                      "bg-red-500/10 text-red-500"
                    }`}>
                      {w.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deposit history */}
      {deposits.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ccb-muted mb-2">Deposit History</p>
          <div className="space-y-2">
            {deposits.slice(0, 8).map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-ccb-surface border border-ccb-border">
                <div>
                  <p className="text-sm font-medium">MWK {Math.floor(d.amount_cents / 100).toLocaleString()}</p>
                  <p className="text-xs text-ccb-muted">{d.method === "mobile_money" ? "Mobile Money" : "Card"} • {new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  d.status === "success" ? "bg-green-500/10 text-green-600" :
                  d.status === "pending" ? "bg-yellow-500/10 text-yellow-600" :
                  "bg-red-500/10 text-red-500"
                }`}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
