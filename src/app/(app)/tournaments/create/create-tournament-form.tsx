'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  ArrowLeft,
  Clock,
  Coins,
  Users,
  Award,
  AlertCircle,
  Loader2,
  Calendar,
  Zap,
  TrendingUp,
  Percent,
} from 'lucide-react';

export default function CreateTournamentPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'arena' | 'swiss' | 'knockout'>('swiss');
  const [timeControl, setTimeControl] = useState<'bullet' | 'blitz' | 'rapid' | 'classical'>('blitz');
  const [initialMinutes, setInitialMinutes] = useState('5');
  const [incrementSeconds, setIncrementSeconds] = useState('0');

  // Paid vs Free
  const [isPaid, setIsPaid] = useState(true);
  const [entryFeeMwk, setEntryFeeMwk] = useState('1000');
  const [minPlayers, setMinPlayers] = useState('4');
  const [maxPlayers, setMaxPlayers] = useState('16');
  const [creatorProfitPercent, setCreatorProfitPercent] = useState('40');
  const [rounds, setRounds] = useState('5');
  const [durationMinutes, setDurationMinutes] = useState('60');

  // Default start time: 1 hour from now formatted for datetime-local
  const defaultStartsAt = new Date(Date.now() + 3600 * 1000)
    .toISOString()
    .slice(0, 16);
  const [startsAt, setStartsAt] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStartsAt(defaultStartsAt);
  }, []);
  const [endsAt, setEndsAt] = useState('');

  const [minRating, setMinRating] = useState('0');
  const [maxRating, setMaxRating] = useState('');

  const handleTimeControlChange = (tc: 'bullet' | 'blitz' | 'rapid' | 'classical') => {
    setTimeControl(tc);
    switch (tc) {
      case 'bullet':
        setInitialMinutes('1');
        setIncrementSeconds('0');
        break;
      case 'blitz':
        setInitialMinutes('5');
        setIncrementSeconds('0');
        break;
      case 'rapid':
        setInitialMinutes('10');
        setIncrementSeconds('0');
        break;
      case 'classical':
        setInitialMinutes('30');
        setIncrementSeconds('0');
        break;
    }
  };

  // Economics preview
  const entryFee = parseFloat(entryFeeMwk) || 0;
  const minP = parseInt(minPlayers) || 4;
  const maxP = parseInt(maxPlayers) || 16;
  const profitPct = parseInt(creatorProfitPercent) || 0;
  const minCollected = entryFee * minP;
  const maxCollected = entryFee * maxP;
  const platformCutPct = 10;

  const calcEconomics = (collected: number) => {
    const platformCut = Math.floor(collected * (platformCutPct / 100));
    const remainder = collected - platformCut;
    const creatorProfit = Math.floor(remainder * (profitPct / 100));
    const prizePool = remainder - creatorProfit;
    return { platformCut, creatorProfit, prizePool };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!name.trim()) {
        throw new Error('Tournament name is required');
      }
      if (!startsAt) {
        throw new Error('Start time is required');
      }
      if (parseInt(minPlayers) < 2) {
        throw new Error('Minimum 2 players required');
      }
      if (maxPlayers && parseInt(maxPlayers) < parseInt(minPlayers)) {
        throw new Error('Max players must be ≥ min players');
      }
      if (isPaid && entryFee <= 0) {
        throw new Error('Entry fee must be greater than 0 for paid tournaments');
      }

      const entryFeeCents = isPaid ? Math.round(entryFee * 100) : 0;

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        type,
        timeControl,
        initialMinutes: parseInt(initialMinutes, 10) || 5,
        incrementSeconds: parseInt(incrementSeconds, 10) || 0,
        maxPlayers: maxPlayers ? parseInt(maxPlayers, 10) : null,
        minPlayers: parseInt(minPlayers, 10) || 2,
        rounds: rounds ? parseInt(rounds, 10) : null,
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        entryFeeCents,
        creatorProfitPercent: isPaid ? parseInt(creatorProfitPercent) || 0 : 0,
        minRating: parseInt(minRating, 10) || 0,
        maxRating: maxRating ? parseInt(maxRating, 10) : null,
      };

      const res = await fetch('/api/tournaments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to create tournament');
      }

      if (data.pendingApproval) {
        alert(data.message || "Tournament created! It's pending admin approval.");
      }
      router.push(`/tournaments/${data.tournament.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the tournament.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 sm:pb-0">
      <div>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 text-sm text-ccb-muted hover:text-ccb-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tournaments</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-ccb-primary/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-ccb-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Create Tournament</h1>
          <p className="text-sm text-ccb-muted">Set up a tournament for the community</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-ccb-danger/10 border border-ccb-danger/20 text-ccb-danger text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-ccb-accent" />
            General Information
          </h3>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tournament Name *</label>
            <input
              type="text"
              className="input w-full"
              placeholder="e.g. Friday Night Blitz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="input w-full min-h-[90px] py-2"
              placeholder="Describe the rules, eligibility, or prizes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tournament Format *</label>
              <select
                className="input w-full"
                value={type}
                onChange={(e) => setType(e.target.value as 'arena' | 'swiss' | 'knockout')}
              >
                <option value="swiss">Swiss</option>
                <option value="arena">Arena</option>
                <option value="knockout">Knockout</option>
              </select>
            </div>

            {(type === 'swiss' || type === 'knockout') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Rounds</label>
                <input
                  type="number"
                  className="input w-full"
                  placeholder="5"
                  min="1"
                  max="20"
                  value={rounds}
                  onChange={(e) => setRounds(e.target.value)}
                />
              </div>
            )}
          </div>

          {type === 'arena' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (Minutes)</label>
              <input
                type="number"
                className="input w-full"
                placeholder="60"
                min="5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Time Control */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-ccb-primary" />
            Time Control
          </h3>

          <div className="space-y-2">
            <label className="text-sm font-medium">Speed Preset</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['bullet', 'blitz', 'rapid', 'classical'] as const).map((tc) => (
                <button
                  key={tc}
                  type="button"
                  onClick={() => handleTimeControlChange(tc)}
                  className={`py-2 px-3 rounded-lg text-sm capitalize font-medium transition-colors border ${
                    timeControl === tc
                      ? 'bg-ccb-primary/10 border-ccb-primary text-ccb-primary'
                      : 'bg-ccb-surface border-transparent text-ccb-muted hover:text-ccb-text'
                  }`}
                >
                  {tc}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Minutes *</label>
              <input
                type="number"
                className="input w-full"
                min="0"
                value={initialMinutes}
                onChange={(e) => setInitialMinutes(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Increment (Seconds) *</label>
              <input
                type="number"
                className="input w-full"
                min="0"
                value={incrementSeconds}
                onChange={(e) => setIncrementSeconds(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-ccb-success" />
            Schedule
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Starts At *</label>
              <input
                type="datetime-local"
                className="input w-full"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ends At (Optional)</label>
              <input
                type="datetime-local"
                className="input w-full"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tournament Type: Free vs Paid */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            Tournament Type
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsPaid(false)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                !isPaid
                  ? 'border-ccb-primary bg-ccb-primary/5'
                  : 'border-ccb-surface bg-ccb-surface/30 hover:border-ccb-muted'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-ccb-primary" />
                <span className="font-semibold text-sm">Free Tournament</span>
              </div>
              <p className="text-xs text-ccb-muted">No entry fee. Play for fun and ranking.</p>
            </button>

            <button
              type="button"
              onClick={() => setIsPaid(true)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                isPaid
                  ? 'border-ccb-primary bg-ccb-primary/5'
                  : 'border-ccb-surface bg-ccb-surface/30 hover:border-ccb-muted'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-ccb-success" />
                <span className="font-semibold text-sm">Paid Tournament</span>
              </div>
              <p className="text-xs text-ccb-muted">Entry fee, prize pool, and you earn a cut.</p>
            </button>
          </div>
        </div>

        {/* Paid Tournament Economics */}
        {isPaid && (
          <div className="card space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-ccb-success" />
              Entry Fee & Earnings
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Entry Fee (MWK)</label>
                <input
                  type="number"
                  className="input w-full"
                  placeholder="1000"
                  min="1"
                  step="1"
                  value={entryFeeMwk}
                  onChange={(e) => setEntryFeeMwk(e.target.value)}
                />
                <p className="text-xs text-ccb-muted">Per player, in MWK</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" />
                  Your Profit Share (%)
                </label>
                <input
                  type="range"
                  className="w-full accent-ccb-primary"
                  min="0"
                  max="100"
                  value={creatorProfitPercent}
                  onChange={(e) => setCreatorProfitPercent(e.target.value)}
                />
                <div className="flex justify-between text-xs text-ccb-muted">
                  <span>0% (all prize pool)</span>
                  <span className="font-bold text-ccb-primary">{creatorProfitPercent}%</span>
                  <span>100% (all profit)</span>
                </div>
                <p className="text-xs text-ccb-muted">
                  After the 10% platform cut, you take {creatorProfitPercent}% of the remainder.
                  The rest goes to the prize pool.
                </p>
              </div>
            </div>

            {/* Economics Breakdown */}
            {entryFee > 0 && minP > 0 && (
              <div className="p-4 rounded-lg bg-ccb-surface/50 border border-ccb-surface space-y-3">
                <p className="text-xs font-medium text-ccb-muted">Economics Preview</p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-ccb-muted mb-1">If minimum met ({minP} players)</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-ccb-muted">Collected:</span>
                        <span className="font-medium">MWK {minCollected.toLocaleString()}</span>
                      </div>
                      {(() => {
                        const e = calcEconomics(minCollected);
                        return (
                          <>
                            <div className="flex justify-between text-ccb-muted/70">
                              <span>Platform (10%):</span>
                              <span>-MWK {e.platformCut.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-ccb-success">
                              <span>Your profit ({profitPct}%):</span>
                              <span>MWK {e.creatorProfit.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-ccb-accent font-medium">
                              <span>Prize pool:</span>
                              <span>MWK {e.prizePool.toLocaleString()}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <p className="text-ccb-muted mb-1">If full ({maxP} players)</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-ccb-muted">Collected:</span>
                        <span className="font-medium">MWK {maxCollected.toLocaleString()}</span>
                      </div>
                      {(() => {
                        const e = calcEconomics(maxCollected);
                        return (
                          <>
                            <div className="flex justify-between text-ccb-muted/70">
                              <span>Platform (10%):</span>
                              <span>-MWK {e.platformCut.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-ccb-success">
                              <span>Your profit ({profitPct}%):</span>
                              <span>MWK {e.creatorProfit.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-ccb-accent font-medium">
                              <span>Prize pool:</span>
                              <span>MWK {e.prizePool.toLocaleString()}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {(() => {
                  const minE = calcEconomics(minCollected);
                  return (
                    <p className="text-xs text-ccb-muted pt-2 border-t border-ccb-surface">
                      ⚠️ If fewer than {minP} players join by start time, all entry fees are refunded and the tournament is cancelled.
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Players & Eligibility */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-ccb-primary" />
            Players & Eligibility
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {isPaid ? "Min Players *" : "Min Players"}
              </label>
              <input
                type="number"
                className="input w-full"
                placeholder="4"
                min="2"
                value={minPlayers}
                onChange={(e) => setMinPlayers(e.target.value)}
              />
              <p className="text-xs text-ccb-muted">
                {isPaid
                  ? "Cancel & refund if not met"
                  : "Cancel if not met"
                }
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Players</label>
              <input
                type="number"
                className="input w-full"
                placeholder="16"
                min="2"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
              <p className="text-xs text-ccb-muted">Leave empty for unlimited</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Minimum Rating</label>
              <input
                type="number"
                className="input w-full"
                placeholder="0"
                min="0"
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Maximum Rating</label>
              <input
                type="number"
                className="input w-full"
                placeholder="No upper limit"
                min="0"
                value={maxRating}
                onChange={(e) => setMaxRating(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/tournaments"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-ccb-surface hover:bg-ccb-surface transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Tournament...</span>
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4" />
                <span>Create Tournament</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
