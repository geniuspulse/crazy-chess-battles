'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, LogOut, Play, Square, Loader2, AlertCircle, ChevronRight } from 'lucide-react';

interface TournamentActionsProps {
  tournamentId: string;
  status: string;
  isJoined: boolean;
  isAdmin: boolean;
}

export default function TournamentActions({
  tournamentId,
  status,
  isJoined,
  isAdmin,
}: TournamentActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: 'join' | 'leave' | 'start' | 'finish' | 'advance-round') => {
    setLoadingAction(action);
    setError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `Failed to ${action} tournament`);
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoadingAction(null);
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
                onClick={() => handleAction('join')}
                disabled={loadingAction !== null}
                className="btn-primary flex items-center gap-2"
              >
                {loadingAction === 'join' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Join Tournament</span>
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
    </div>
  );
}
