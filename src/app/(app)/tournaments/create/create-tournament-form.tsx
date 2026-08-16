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
  const [maxPlayers, setMaxPlayers] = useState('');
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

  const [entryFeeMwk, setEntryFeeMwk] = useState('0');
  const [prizePoolMwk, setPrizePoolMwk] = useState('0');
  const [minRating, setMinRating] = useState('0');
  const [maxRating, setMaxRating] = useState('');

  // Auto-adjust time controls when selecting preset
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

      // Convert MWK inputs to Cents (1 MWK = 100 Cents)
      const entryFeeCents = Math.round((parseFloat(entryFeeMwk) || 0) * 100);
      const prizePoolCents = Math.round((parseFloat(prizePoolMwk) || 0) * 100);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        type,
        timeControl,
        initialMinutes: parseInt(initialMinutes, 10) || 5,
        incrementSeconds: parseInt(incrementSeconds, 10) || 0,
        maxPlayers: maxPlayers ? parseInt(maxPlayers, 10) : null,
        rounds: rounds ? parseInt(rounds, 10) : null,
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        entryFeeCents,
        prizePoolCents,
        minRating: parseInt(minRating, 10) || 0,
        maxRating: maxRating ? parseInt(maxRating, 10) : null,
      };

      const res = await fetch('/api/tournaments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to create tournament');
      }

      router.push('/tournaments');
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
          <p className="text-sm text-ccb-muted">Configure and schedule a new competitive tournament</p>
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
              placeholder="e.g. Grand Master Blitz Championship"
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Players</label>
              <input
                type="number"
                className="input w-full"
                placeholder="Unlimited if empty"
                min="2"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
            </div>
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

        {/* Financials & Rating Restrictions */}
        <div className="card space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            Entry Fee, Prizes & Eligibility
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Entry Fee (MWK)</label>
              <input
                type="number"
                className="input w-full"
                placeholder="0 for free entry"
                min="0"
                step="1"
                value={entryFeeMwk}
                onChange={(e) => setEntryFeeMwk(e.target.value)}
              />
              <p className="text-xs text-ccb-muted">Amount in MWK (e.g. 5,000)</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prize Pool (MWK)</label>
              <input
                type="number"
                className="input w-full"
                placeholder="0 if no guaranteed prize"
                min="0"
                step="1"
                value={prizePoolMwk}
                onChange={(e) => setPrizePoolMwk(e.target.value)}
              />
              <p className="text-xs text-ccb-muted">Total prize pool in MWK</p>
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
