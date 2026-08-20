'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  UserPlus, LogOut, Play, Square, Loader2, AlertCircle, ChevronRight,
  Wallet, Smartphone, Check, X, Lock, RefreshCw,
} from 'lucide-react';
import { detectOperator } from '@/lib/operator';

interface TournamentActionsProps {
  tournamentId: string;
  status: string;
  isJoined: boolean;
  isLoggedIn: boolean;
  entryFeeCents: number;
  prizePoolCents: number;
  walletBalanceCents: number;
  isAdmin: boolean;
}

export default function TournamentActions({
  tournamentId,
  status,
  isJoined,
  isLoggedIn,
  entryFeeCents,
  prizePoolCents,
  walletBalanceCents,
  isAdmin,
}: TournamentActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [autoJoinAfterDeposit, setAutoJoinAfterDeposit] = useState(false);

  // Deposit state
  const [phone, setPhone] = useState('');
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const [pendingChargeId, setPendingChargeId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Auto-join: if user was redirected to login and came back with ?action=join
  useEffect(() => {
    if (isLoggedIn && searchParams.get('action') === 'join' && status === 'upcoming' && !isJoined) {
      handleAction('join');
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.toString());
    }
  }, [isLoggedIn, searchParams, status, isJoined]);

  // Payment verification polling
  useEffect(() => {
    if (!pendingChargeId) return;

    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chargeId: pendingChargeId }),
        });
        const data = await res.json();

        if (data.status === 'success') {
          const amt = Math.floor(data.amount / 100).toLocaleString();
          setDepositSuccess(`MWK ${amt} added to your wallet!`);
          setPolling(false);
          setPendingChargeId(null);
          clearInterval(interval);

          if (autoJoinAfterDeposit) {
            // Wait a moment for the success message, then auto-join
            setTimeout(() => {
              setShowDeposit(false);
              setAutoJoinAfterDeposit(false);
              handleAction('join', true); // skipBalanceCheck = true (just deposited)
            }, 1500);
          } else {
            router.refresh();
          }
        } else if (data.status === 'failed') {
          setDepositError('Payment failed or timed out. Please try again.');
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
        setDepositError('Payment verification timed out. If you completed the payment, your balance will update shortly.');
        setPendingChargeId(null);
      }
    }, 180000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pendingChargeId, router, autoJoinAfterDeposit]);

  const handleAction = async (action: 'join' | 'leave' | 'start' | 'finish' | 'advance-round', skipBalanceCheck = false) => {
    setLoadingAction(action);
    setError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        // Check for insufficient funds
        if (res.status === 402 && action === 'join') {
          // Show inline deposit widget
          const feeMwk = Math.ceil(entryFeeCents / 100);
          setDepositAmount(feeMwk);
          setShowDeposit(true);
          setAutoJoinAfterDeposit(true);
          setError(null); // Clear the error — we're handling it with the deposit UI
          return;
        }
        throw new Error(data.error || `Failed to ${action} tournament`);
      }

      if (action === 'join') {
        setShowDeposit(false);
        setAutoJoinAfterDeposit(false);
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoinClick = () => {
    if (!isLoggedIn) {
      // Redirect to login with return URL + action=join
      const currentPath = `/tournaments/${tournamentId}`;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}&action=join`);
      return;
    }
    handleAction('join');
  };

  const handleDeposit = async () => {
    setDepositLoading(true);
    setDepositError(null);
    setDepositSuccess(null);

    try {
      if (!phone || phone.length < 9) {
        setDepositError('Enter a valid phone number (e.g., 0991234567)');
        setDepositLoading(false);
        return;
      }

      const res = await fetch('/api/payments/deposit/mobile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: depositAmount * 100,
          phone,
          operatorRefId: detectOperator(phone),
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Payment failed. Please try again.');
      }

      setPendingChargeId(data.chargeId);
      setDepositSuccess('Check your phone to authorize the payment. Waiting for confirmation...');
    } catch (err: any) {
      setDepositError(err.message && err.message.length < 200 ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setDepositLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 text-sm text-ccb-danger bg-ccb-danger/10 border border-ccb-danger/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Join / Leave buttons for upcoming tournaments */}
        {status === 'upcoming' && (
          <>
            {!isJoined ? (
              <button
                onClick={handleJoinClick}
                disabled={loadingAction !== null}
                className="btn-primary flex items-center gap-2"
              >
                {loadingAction === 'join' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : !isLoggedIn ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Log in to {entryFeeCents > 0 ? `Join — MWK ${Math.floor(entryFeeCents / 100).toLocaleString()}` : 'Join'}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{entryFeeCents > 0 ? `Join — MWK ${Math.floor(entryFeeCents / 100).toLocaleString()}` : 'Join Tournament'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => handleAction('leave')}
                disabled={loadingAction !== null}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-ccb-danger/40 text-ccb-danger hover:bg-ccb-danger/10 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loadingAction === 'leave' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Leaving...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>Leave Tournament</span>
                  </>
                )}
              </button>
            )}
          </>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <>
            {status === 'upcoming' && (
              <button
                onClick={() => handleAction('start')}
                disabled={loadingAction !== null}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-ccb-success text-white hover:bg-ccb-success/90 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loadingAction === 'start' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Tournament</span>
                  </>
                )}
              </button>
            )}

            {status === 'active' && (
              <>
                <button
                  onClick={() => handleAction('advance-round')}
                  disabled={loadingAction !== null}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-ccb-primary text-white hover:bg-ccb-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingAction === 'advance-round' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Advancing...</span>
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      <span>Advance Round</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleAction('finish')}
                  disabled={loadingAction !== null}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-ccb-danger text-white hover:bg-ccb-danger/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingAction === 'finish' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Finishing...</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>Finish Tournament</span>
                    </>
                  )}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Inline Deposit Widget — shows when user has insufficient balance to join */}
      {showDeposit && (
        <div className="card border border-ccb-accent/30 space-y-4 p-4 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-ccb-accent" />
                Deposit to Join Tournament
              </h3>
              <p className="text-xs text-ccb-muted mt-1">
                Entry fee: MWK {Math.floor(entryFeeCents / 100).toLocaleString()} · Your balance: MWK {Math.floor(walletBalanceCents / 100).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => { setShowDeposit(false); setAutoJoinAfterDeposit(false); setDepositError(null); setDepositSuccess(null); }}
              className="text-ccb-muted hover:text-ccb-fg p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {depositSuccess && (
            <div className="p-3 text-sm text-ccb-success bg-ccb-success/10 border border-ccb-success/20 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{depositSuccess}</span>
            </div>
          )}

          {depositError && (
            <div className="p-3 text-sm text-ccb-danger bg-ccb-danger/10 border border-ccb-danger/20 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{depositError}</span>
            </div>
          )}

          {pendingChargeId ? (
            <div className="flex items-center justify-center py-6 space-y-3 flex-col">
              <Loader2 className="w-6 h-6 animate-spin text-ccb-accent" />
              <p className="text-sm text-ccb-muted">Waiting for payment confirmation...</p>
              <p className="text-xs text-ccb-muted">Check your phone and authorize the payment.</p>
            </div>
          ) : (
            !depositSuccess && (
              <>
                {/* Amount — pre-filled with entry fee, can add more */}
                <div>
                  <label className="text-xs font-medium text-ccb-muted">Amount (MWK)</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="input-field mt-1 w-full"
                    min={entryFeeCents / 100}
                  />
                  <div className="flex gap-2 mt-2">
                    {[Math.ceil(entryFeeCents / 100), 1000, 2000, 5000].filter((amt, i, arr) => arr.indexOf(amt) === i).map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setDepositAmount(amt)}
                        className="text-xs px-2 py-1 rounded bg-ccb-surface border border-ccb-border text-ccb-muted hover:bg-ccb-accent/10 hover:text-ccb-accent transition-colors"
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phone number */}
                <div>
                  <label className="text-xs font-medium text-ccb-muted">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0991234567"
                    className="input-field mt-1 w-full"
                  />
                </div>

                <button
                  onClick={handleDeposit}
                  disabled={depositLoading || !phone || depositAmount < 1}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {depositLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initiating...</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4" />
                      <span>Deposit MWK {depositAmount.toLocaleString()}</span>
                    </>
                  )}
                </button>

                {autoJoinAfterDeposit && (
                  <p className="text-xs text-ccb-accent text-center flex items-center justify-center gap-1">
                    <Check className="w-3 h-3" />
                    You'll be auto-joined to the tournament after deposit confirms
                  </p>
                )}
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
