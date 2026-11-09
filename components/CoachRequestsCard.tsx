import React, { useCallback, useEffect, useState } from 'react';
import { UserCheck, Loader2 } from 'lucide-react';
import { Player } from '../types';
import { db } from '../services/db';

// The admin's list of people who chose "Coach" at sign-up. Approve turns on coach access;
// Decline clears the request and leaves them a player.
const CoachRequestsCard: React.FC = () => {
  const [requests, setRequests] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const players = await db.getPlayers();
      setRequests(players.filter(p => p.coachRequested && p.role !== 'Coach' && !p.mergedInto));
      setError(null);
    } catch (e) {
      console.error('[CoachRequestsCard] Could not load requests:', e);
      setError('Could not load coach requests.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (p: Player, approve: boolean) => {
    setBusyId(p.id);
    setError(null);
    try {
      if (approve) await db.updatePlayerRole(p.id, 'Coach');
      else await db.declineCoachRequest(p.id);
      await load();
    } catch (e) {
      console.error('[CoachRequestsCard] Could not update request:', e);
      setError(`Could not ${approve ? 'approve' : 'decline'} ${p.name}. Try again.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl mb-3 space-y-3">
      <div className="flex items-center gap-2">
        <UserCheck size={16} className="text-amber-400" />
        <h3 className="text-sm font-bold text-white">Coach requests</h3>
        {requests.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{requests.length}</span>}
      </div>
      {loading ? (
        <Loader2 size={16} className="animate-spin text-neutral-500" />
      ) : requests.length === 0 ? (
        <p className="text-xs text-neutral-500">No one is waiting. People who choose Coach at sign-up show up here.</p>
      ) : (
        <div className="space-y-2">
          {requests.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{p.name}</p>
                {p.email && <p className="text-[11px] text-neutral-500 truncate">{p.email}</p>}
              </div>
              <button onClick={() => act(p, false)} disabled={busyId !== null}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs disabled:opacity-40">Decline</button>
              <button onClick={() => act(p, true)} disabled={busyId !== null}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs disabled:opacity-40">
                {busyId === p.id ? '...' : 'Approve'}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};

export default CoachRequestsCard;
