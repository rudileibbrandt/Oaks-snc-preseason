import React, { useEffect, useState } from 'react';
import { KeyRound, Copy, Check, Loader2 } from 'lucide-react';
import { Player } from '../types';
import { db } from '../services/db';
import { cleanJoinCode } from '../services/authErrors';

interface Props {
  currentPlayer?: Player | null;
  title?: string;
  note?: string;
  load?: () => Promise<string | null>;
  save?: (code: string, by: string) => Promise<string>;
}

// A join code to share and change (e.g. if it leaks). Changing it doesn't affect anyone who
// already joined. Defaults to the team code; the admin also gets one for the coach code.
const TeamCodeCard: React.FC<Props> = ({
  currentPlayer,
  title = 'Team join code',
  note = "New players and coaches enter this when they sign up. Changing it doesn't sign anyone out.",
  load = db.getJoinCode,
  save = db.setJoinCode,
}) => {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load()
      .then(setCode)
      .catch(e => { console.error('[TeamCodeCard] Could not load code:', e); setError('Could not load the team code.'); })
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('[TeamCodeCard] Copy failed:', e);
    }
  };

  const handleSave = async () => {
    const clean = cleanJoinCode(draft);
    if (clean.length < 4) { setError('Use at least 4 letters or numbers.'); return; }
    setSaving(true);
    setError(null);
    try {
      setCode(await save(clean, currentPlayer?.name ?? 'Coach'));
      setEditing(false);
    } catch (e) {
      console.error('[TeamCodeCard] Could not save code:', e);
      setError('Could not save. Only coaches can change the code.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl mb-3 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-amber-400" />
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      {loading ? (
        <Loader2 size={16} className="animate-spin text-neutral-500" />
      ) : editing ? (
        <div className="flex gap-2">
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="OAKS-XXXX" autoCapitalize="characters"
            className="flex-1 min-w-0 px-3 py-2 bg-black border border-neutral-700 rounded-lg text-sm text-white uppercase tracking-wider" />
          <button onClick={() => setEditing(false)} disabled={saving} className="px-3 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !draft.trim()} className="px-3 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm disabled:opacity-40">
            {saving ? '...' : 'Save'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-widest text-amber-400 select-all">{code ?? '—'}</span>
          <button onClick={handleCopy} className="p-2 text-neutral-400 hover:text-white" aria-label="Copy code">
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
          <button onClick={() => { setDraft(code ?? ''); setEditing(true); setError(null); }} className="ml-auto text-xs text-amber-400 hover:text-white">Change</button>
        </div>
      )}
      <p className="text-xs text-neutral-500">{note}</p>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};

export default TeamCodeCard;
