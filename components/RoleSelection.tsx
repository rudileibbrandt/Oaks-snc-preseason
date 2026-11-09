import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { db } from '../services/db';
import type { Player } from '../types';
import { withTimeout } from '../services/authErrors';
import TeamCodeField from './TeamCodeField';
import { getCurrentUser, signOut } from '../services/auth';
import { classKey, classLabel, currentClassYears } from '../services/classYears';

interface Props {
  onComplete: (player: Player) => void; // the profile just saved
}

type Kind = 'coach' | 'player';

// A starting guess at the name from the sign-in (Google name, or first.last@ email). Always
// shown for editing: a Google account may be a parent's.
const guessName = (): [string, string] => {
  const user = getCurrentUser();
  const display = user?.displayName?.trim();
  if (display) {
    const parts = display.split(/\s+/);
    return [parts[0], parts.slice(1).join(' ')];
  }
  const local = user?.email?.split('@')[0] ?? '';
  const parts = local.split(/[._-]/).filter(Boolean);
  const cap = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);
  return parts.length >= 2 ? [cap(parts[0]), parts.slice(1).map(cap).join(' ')] : ['', ''];
};

const inputClass = 'w-full bg-black border border-neutral-800 p-3 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50';
const choiceClass = (on: boolean) => `rounded-xl border font-bold transition-all disabled:opacity-50 ${
  on ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
     : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-amber-500/50'}`;

// Sign-up: 1) the code, which decides coach or player (coach code or team code); 2) the profile.
const RoleSelection: React.FC<Props> = ({ onComplete }) => {
  const [kind, setKind] = useState<Kind | null>(null);
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState(() => guessName()[0]);
  const [lastName, setLastName] = useState(() => guessName()[1]);
  const [position, setPosition] = useState<'Forward' | 'Back' | undefined>(undefined);
  const [gradYear, setGradYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCode = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setKind(await withTimeout(db.joinTeam(code), 20000, 'Checking the code is taking too long. Check your connection and try again.'));
    } catch (e: any) {
      console.error('[RoleSelection] Join failed:', e);
      setError(e?.code === 'permission-denied'
        ? "That code isn't right. Check it with your coach."
        : e?.message || 'Could not check the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const isPlayer = kind === 'player';
  const ready = !!firstName.trim() && !!lastName.trim() && (!isPlayer || (!!position && !!gradYear));

  const handleSubmit = async () => {
    if (!kind || !ready) return;
    setBusy(true);
    setError(null);
    try {
      // A save that never answers must not spin forever. Retrying is safe: the profile is saved
      // under the sign-in's own id, so a second tap can't make a second profile.
      const player = await withTimeout(
        db.getOrCreatePlayerForUser(isPlayer ? 'Player' : 'Coach', isPlayer ? position : undefined, `${firstName.trim()} ${lastName.trim()}`),
        20000,
        'Saving your profile is taking too long. Check your connection and tap Continue again.'
      );
      // Save the player's class by name (coaches can change it on the Player Roster).
      // A failure here shouldn't block sign-up.
      if (isPlayer && gradYear) {
        try {
          await db.setRosterClass(classKey(player.name), player.name, { gradYear });
        } catch (classErr) {
          console.error('[RoleSelection] Could not save class:', classErr);
        }
      }
      onComplete(player);
    } catch (err: any) {
      console.error('[RoleSelection] Profile save failed:', err);
      setError(err?.message || 'Failed to create profile. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] animate-fade-in">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Welcome to The Oaks</h1>
          <p className="text-neutral-400 text-sm">
            {!kind ? 'Enter the code from your coach' : isPlayer ? 'Your player profile' : 'Your coach profile'}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-start text-red-500 text-sm">
            <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!kind ? (
          <>
            <TeamCodeField value={code} onChange={v => { setCode(v); setError(null); }} disabled={busy} />
            <button
              onClick={handleCode}
              disabled={busy || !code.trim()}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-4 px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {busy ? <Loader2 size={20} className="animate-spin" /> : 'Continue'}
            </button>
          </>
        ) : (
          <>
            {!isPlayer && (
              <p className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
                Coach code accepted: you'll have coach access.
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-neutral-400 text-sm mb-2 font-medium">First Name</label>
                <input type="text" value={firstName} placeholder="John" disabled={busy} className={inputClass}
                  onChange={e => { setFirstName(e.target.value); setError(null); }} />
              </div>
              <div>
                <label className="block text-neutral-400 text-sm mb-2 font-medium">Last Name</label>
                <input type="text" value={lastName} placeholder="Doe" disabled={busy} className={inputClass}
                  onChange={e => { setLastName(e.target.value); setError(null); }} />
              </div>
            </div>

            {isPlayer && (
              <>
                <div>
                  <label className="block text-neutral-400 text-sm mb-3 font-medium">Position Group</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['Forward', 'Back'] as const).map(p => (
                      <button key={p} onClick={() => { setPosition(p); setError(null); }} disabled={busy}
                        className={`p-4 ${choiceClass(position === p)}`}>{p}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-neutral-400 text-sm mb-3 font-medium">Class (graduation year)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {currentClassYears().map(year => (
                      <button key={year} onClick={() => { setGradYear(year); setError(null); }} disabled={busy}
                        className={`p-3 text-sm ${choiceClass(gradYear === year)}`}>{classLabel(year)}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              onClick={handleSubmit}
              disabled={busy || !ready}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-4 px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {busy ? (<><Loader2 size={20} className="mr-2 animate-spin" />Creating Profile...</>) : 'Continue'}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => signOut().catch(e => console.error('[RoleSelection] Sign out failed:', e))}
          disabled={busy}
          className="w-full text-sm text-neutral-500 hover:text-neutral-300 underline disabled:opacity-50"
        >
          Wrong account? Sign out
        </button>
      </div>
    </div>
  );
};

export default RoleSelection;
