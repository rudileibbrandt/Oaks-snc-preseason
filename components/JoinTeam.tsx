import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { db } from '../services/db';
import { signOut } from '../services/auth';
import { withTimeout } from '../services/authErrors';
import TeamCodeField from './TeamCodeField';

interface Props {
  onJoined: () => void;
}

// For a signed-in user who has a profile but isn't a team member yet (e.g. a profile made by an
// older version of the app). Team data stays locked until they enter the code.
const JoinTeam: React.FC<Props> = ({ onJoined }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await withTimeout(db.joinTeam(code), 20000, 'Joining the team is taking too long. Check your connection and try again.');
      onJoined();
    } catch (e: any) {
      console.error('[JoinTeam] Join failed:', e);
      setError(e?.code === 'permission-denied'
        ? "That team code isn't right. Check it with your coach."
        : e?.message || 'Could not join. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] animate-fade-in">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-black text-white mb-2">Join your team</h1>
          <p className="text-neutral-400 text-sm">Enter the team code to see the Oaks' training, testing and stats.</p>
        </div>
        {error && (
          <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-start text-red-500 text-sm">
            <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <TeamCodeField value={code} onChange={v => { setCode(v); setError(null); }} disabled={busy} />
        <button
          onClick={handleJoin}
          disabled={busy || !code.trim()}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-4 px-6 rounded-xl flex items-center justify-center disabled:opacity-50"
        >
          {busy ? <Loader2 size={20} className="animate-spin" /> : 'Join'}
        </button>
        <button
          type="button"
          onClick={() => signOut().catch(e => console.error('[JoinTeam] Sign out failed:', e))}
          disabled={busy}
          className="w-full text-sm text-neutral-500 hover:text-neutral-300 underline disabled:opacity-50"
        >
          Wrong account? Sign out
        </button>
      </div>
    </div>
  );
};

export default JoinTeam;
