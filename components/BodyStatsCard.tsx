import React, { useState } from 'react';
import { Scale, Loader2 } from 'lucide-react';
import { BodyMeasurement, Player } from '../types';
import { BodyStats, checkHeight, checkWeight, formatHeight } from '../services/bodyStats';
import { normalizeName } from '../services/alumni';

interface Props {
  playerName: string; // roster name of the player shown
  stats: BodyStats;
  currentPlayer: Player | null; // who is looking: the player themself or a coach can edit
  onAdd: (entry: Omit<BodyMeasurement, 'id' | 'enteredByUserId'>) => Promise<void>;
}

// Local date, not UTC, so an evening entry isn't dated tomorrow.
const todayIso = () => new Date().toLocaleDateString('en-CA');
const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const SOURCE_LABEL = { self: 'player', coach: 'coach', test: 'testing day' } as const;

const BodyStatsCard: React.FC<Props> = ({ playerName, stats, currentPlayer, onAdd }) => {
  const isCoach = currentPlayer?.role === 'Coach';
  const isSelf = !!currentPlayer && normalizeName(currentPlayer.name) === normalizeName(playerName);
  const canEdit = isCoach || isSelf;

  const [editing, setEditing] = useState(false);
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const handleStartEditing = () => {
    setFeet(stats.heightIn != null ? String(Math.floor(stats.heightIn / 12)) : '');
    setInches(stats.heightIn != null ? String(stats.heightIn % 12) : '');
    setWeight('');
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    const heightIn = feet.trim() ? Number(feet) * 12 + Number(inches || 0) : undefined;
    const weightLb = weight.trim() ? Number(weight) : undefined;
    // Height is only saved when it changed; a weigh-in is always worth keeping, even if the same.
    const newHeight = heightIn != null && heightIn !== stats.heightIn ? heightIn : undefined;
    if (newHeight == null && weightLb == null) { setError('Enter a new weight or height'); return; }
    if (newHeight != null && (!Number.isInteger(Number(inches || 0)) || Number(inches || 0) > 11)) { setError('Inches should be 0 to 11'); return; }
    const problem = (newHeight != null && checkHeight(newHeight)) || (weightLb != null && checkWeight(weightLb));
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError(null);
    try {
      await onAdd({
        nameKey: normalizeName(playerName), playerName, date: todayIso(),
        heightIn: newHeight, weightLb,
        enteredBy: currentPlayer!.name, enteredByRole: isCoach ? 'Coach' : 'Player', createdAt: Date.now(),
      });
      setEditing(false);
    } catch (e) {
      console.error('[BodyStatsCard] save failed', e);
      setError('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const history = showAll ? stats.weightHistory : stats.weightHistory.slice(0, 3);
  const input = 'w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-2 text-white text-sm focus:border-amber-500 outline-none';

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-left">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <Scale size={14} /> Height &amp; weight
        </h3>
        {canEdit && !editing && (
          <button onClick={handleStartEditing} className="text-xs text-amber-500 font-medium hover:text-amber-400">Update</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <p className="text-[11px] text-neutral-500">Height</p>
          <p className="text-lg font-bold text-white">{stats.heightIn != null ? formatHeight(stats.heightIn) : '—'}</p>
          <p className="text-[11px] text-neutral-500">{stats.heightDate ? shortDate(stats.heightDate) : stats.heightIn != null ? 'from roster' : 'not entered'}</p>
        </div>
        <div>
          <p className="text-[11px] text-neutral-500">Weight</p>
          <p className="text-lg font-bold text-white">{stats.weightLb != null ? `${stats.weightLb} lb` : '—'}</p>
          <p className="text-[11px] text-neutral-500">{stats.weightDate ? shortDate(stats.weightDate) : stats.weightLb != null ? 'from roster' : 'not entered'}</p>
        </div>
      </div>

      {editing && (
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[11px] text-neutral-400 mb-1">Height</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-1.5"><input inputMode="numeric" value={feet} onChange={e => setFeet(e.target.value.replace(/\D/g, ''))} maxLength={1} className={input} /><span className="text-xs text-neutral-500">ft</span></label>
              <label className="flex items-center gap-1.5"><input inputMode="numeric" value={inches} onChange={e => setInches(e.target.value.replace(/\D/g, ''))} maxLength={2} className={input} /><span className="text-xs text-neutral-500">in</span></label>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400 mb-1">Weight today</p>
            <label className="flex items-center gap-1.5">
              <input inputMode="decimal" value={weight} placeholder={stats.weightLb != null ? String(stats.weightLb) : ''}
                onChange={e => setWeight(e.target.value.replace(/[^\d.]/g, ''))} maxLength={5} className={input} />
              <span className="text-xs text-neutral-500">lb</span>
            </label>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-amber-500 text-black text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1">
              {saving && <Loader2 size={14} className="animate-spin" />} Save
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}
              className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {stats.weightHistory.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <p className="text-[11px] text-neutral-500 mb-1">Weight history</p>
          <ul className="space-y-1">
            {history.map((h, i) => (
              <li key={`${h.date}-${h.at}-${i}`} className="flex justify-between text-xs">
                <span className="text-neutral-400">{shortDate(h.date)} · {SOURCE_LABEL[h.source]}</span>
                <span className="text-white font-medium">{h.weightLb} lb</span>
              </li>
            ))}
          </ul>
          {stats.weightHistory.length > 3 && (
            <button onClick={() => setShowAll(v => !v)} className="mt-1 text-[11px] text-amber-500">
              {showAll ? 'Show less' : `Show all ${stats.weightHistory.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BodyStatsCard;
