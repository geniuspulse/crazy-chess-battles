"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet, Smartphone, CreditCard, Check, Loader2, ArrowDown, ArrowUp, Clock } from "lucide-react";

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
  email: string;
  deposits: Deposit[];
  phone?: string | null;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];

const OPERATORS = [
  { id: "27494cb5-ba9e-437f-a114-4e7a7686bcca", name: "TNM Mpamba", color: "bg-blue-500" },
  { id: "20be6c20-adeb-4b5b-a7ba-0769820df4fb", name: "Airtel Money", color: "bg-red-500" },
];

export default function WalletClient({ balanceCents, email, deposits, phone: savedPhone }: WalletClientProps) {
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

  // Fetch real operators from Paychangu
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

  // Fetch user withdrawals
  useEffect(() => {
    fetch("/api/withdrawals/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.withdrawals) setWithdrawals(data.withdrawals);
      })
      .catch(() => {});
  }, []);

  // Check for tx_ref return from card payment
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

  // Poll for mobile money payment status
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
          throw new Error(data.error || "Failed to initiate payment");
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
          throw new Error(data.error || "Failed to initiate payment");
        }

        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
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
        throw new Error(data.error || "Failed to request withdrawal");
      }

      setSuccess(`Withdrawal request for MWK ${amount.toLocaleString()} submitted. You'll receive it within 24 hours after admin approval.`);
      router.refresh();

      // Refresh withdrawals list
      fetch("/api/withdrawals/list")
        .then((r) => r.json())
        .then((d) => { if (d.withdrawals) setWithdrawals(d.withdrawals); });
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
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

      {/* Success message */}
      {success && (
        <div className="rounded-lg bg-ccb-success/10 border border-ccb-success/30 text-ccb-success px-4 py-3 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-ccb-danger/10 border border-ccb-danger/30 text-ccb-danger px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Polling indicator */}
      {polling && (
        <div className="rounded-lg bg-ccb-primary/10 border border-ccb-primary/30 px-4 py-3 text-sm flex items-center gap-2 text-ccb-primary">
          <Loader2 className="w-4 h-4 animate-spin" />
          Waiting for payment confirmation...
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab("deposit"); setError(null); setSuccess(null); }}
          className={`flex-1 px-4 py-3 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm font-medium ${
            tab === "deposit"
              ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary"
              : "border-ccb-surface text-ccb-muted hover:border-ccb-border"
          }`}
        >
          <ArrowDown className="w-4 h-4" />
          Deposit
        </button>
        <button
          onClick={() => { setTab("withdraw"); setError(null); setSuccess(null); }}
          className={`flex-1 px-4 py-3 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm font-medium ${
            tab === "withdraw"
              ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary"
              : "border-ccb-surface text-ccb-muted hover:border-ccb-border"
          }`}
        >
          <ArrowUp className="w-4 h-4" />
          Withdraw
        </button>
      </div>

      {/* Deposit Form */}
      {tab === "deposit" && (
        <div className="card space-y-5">
          <h3 className="font-medium flex items-center gap-2">
            <ArrowDown className="w-4 h-4 text-ccb-primary" />
            Deposit Funds
          </h3>

          {/* Method tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setMethod("mobile_money")}
              className={`flex-1 px-4 py-3 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm font-medium ${
                method === "mobile_money"
                  ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary"
                  : "border-ccb-surface text-ccb-muted hover:border-ccb-border"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Mobile Money
            </button>
            <button
              onClick={() => setMethod("card")}
              className={`flex-1 px-4 py-3 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm font-medium ${
                method === "card"
                  ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary"
                  : "border-ccb-surface text-ccb-muted hover:border-ccb-border"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Card
            </button>
          </div>

          {/* Amount selection */}
          <div>
            <label className="text-sm text-ccb-muted mb-2 block">Amount (MWK)</label>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    amount === amt
                      ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary"
                      : "border-ccb-surface text-ccb-muted hover:border-ccb-border"
                  }`}
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile money fields */}
          {method === "mobile_money" && (
            <>
              {/* Operator selection */}
              <div>
                <label className="text-sm text-ccb-muted mb-2 block">Operator</label>
                <div className="flex gap-2">
                  {operators.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => setOperator(op.id)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        operator === op.id
                          ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary"
                          : "border-ccb-surface text-ccb-muted hover:border-ccb-border"
                      }`}
                    >
                      {op.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone number */}
              <div>
                <label className="text-sm text-ccb-muted mb-2 block">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0991234567"
                  className="input-field"
                />
                <p className="text-xs text-ccb-muted mt-1">
                  You'll receive a prompt on this number to authorize the payment
                </p>
              </div>
            </>
          )}

          {/* Card info */}
          {method === "card" && (
            <div className="rounded-lg bg-ccb-surface/50 border border-ccb-surface p-3">
              <p className="text-xs text-ccb-muted">
                You'll be redirected to Paychangu's secure checkout to enter your card details.
                Your card information is never stored on our servers.
              </p>
            </div>
          )}

          {/* Deposit button */}
          <button
            onClick={handleDeposit}
            disabled={loading || polling}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : polling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Waiting for confirmation...</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-4 h-4" />
                <span>Deposit MWK {amount.toLocaleString()}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Withdraw Form */}
      {tab === "withdraw" && (
        <div className="card space-y-5">
          <h3 className="font-medium flex items-center gap-2">
            <ArrowUp className="w-4 h-4 text-ccb-primary" />
            Withdraw Funds
          </h3>

          <div className="rounded-lg bg-ccb-surface/50 border border-ccb-surface p-3">
            <p className="text-xs text-ccb-muted">
              Withdrawals are processed within 24 hours. Minimum: MWK 10. Funds are debited immediately and held until your withdrawal is approved.
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm text-ccb-muted mb-2 block">Amount (MWK)</label>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.filter(a => a >= 500).map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    amount === amt
                      ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary"
                      : "border-ccb-surface text-ccb-muted hover:border-ccb-border"
                  }`}
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
            <p className="text-xs text-ccb-muted mt-2">Available: MWK {Math.floor(balanceCents / 100).toLocaleString()}</p>
          </div>

          {/* Operator */}
          <div>
            <label className="text-sm text-ccb-muted mb-2 block">Mobile Money Operator</label>
            <div className="flex gap-2">
              {operators.map((op) => (
                <button
                  key={op.id}
                  onClick={() => setOperator(op.id)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    operator === op.id
                      ? "border-ccb-primary bg-ccb-primary/10 text-ccb-primary"
                      : "border-ccb-surface text-ccb-muted hover:border-ccb-border"
                  }`}
                >
                  {op.name}
                </button>
              ))}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm text-ccb-muted mb-2 block">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0991234567"
              className="input-field"
            />
            <p className="text-xs text-ccb-muted mt-1">Money will be sent to this number</p>
          </div>

          {/* Withdraw button */}
          <button
            onClick={handleWithdraw}
            disabled={withdrawLoading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {withdrawLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <ArrowUp className="w-4 h-4" />
                <span>Withdraw MWK {amount.toLocaleString()}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Transaction history */}
      <div className="card space-y-3">
        <h3 className="font-medium text-sm text-ccb-muted uppercase tracking-wide">Transaction History</h3>
        {deposits.length > 0 || withdrawals.length > 0 ? (
          <div className="space-y-2">
            {/* Deposits */}
            {deposits.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-ccb-surface/50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    d.status === "success" ? "bg-ccb-success/10" : "bg-ccb-muted/10"
                  }`}>
                    <ArrowDown className="w-4 h-4 text-ccb-success" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">MWK {Math.floor(d.amount_cents / 100).toLocaleString()}</div>
                    <div className="text-xs text-ccb-muted">
                      {new Date(d.created_at).toLocaleDateString()} · {d.method.replace("_", " ")}
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  d.status === "success" ? "bg-ccb-success/10 text-ccb-success" :
                  d.status === "pending" ? "bg-ccb-accent/10 text-ccb-accent" :
                  "bg-ccb-danger/10 text-ccb-danger"
                }`}>
                  {d.status}
                </span>
              </div>
            ))}
            {/* Withdrawals */}
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-ccb-surface/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-ccb-accent/10">
                    <ArrowUp className="w-4 h-4 text-ccb-accent" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">MWK {Math.floor(w.amount_cents / 100).toLocaleString()}</div>
                    <div className="text-xs text-ccb-muted">
                      {new Date(w.created_at).toLocaleDateString()} · {w.operator_name}
                      {w.admin_notes ? ` · ${w.admin_notes}` : ""}
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  w.status === "completed" ? "bg-ccb-success/10 text-ccb-success" :
                  w.status === "pending" ? "bg-ccb-accent/10 text-ccb-accent" :
                  w.status === "approved" ? "bg-ccb-primary/10 text-ccb-primary" :
                  "bg-ccb-danger/10 text-ccb-danger"
                }`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-ccb-muted text-sm">
            <Clock className="w-6 h-6 mx-auto mb-1 opacity-50" />
            No transactions yet
          </div>
        )}
      </div>
    </div>
  );
}
