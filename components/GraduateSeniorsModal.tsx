import React, { useMemo, useState } from 'react';
import { GraduationCap, Search, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { Player } from '../types';
import { ROSTER_PLAYERS, getPhotoUrl } from '../services/rosterData';
import { db } from '../services/db';
import { isAlumni, defaultAlumniClass, normalizeName } from '../services/alumni';

interface Props {
  appPlayers: Player[];
  onClose: () => void;
  onDone: () => void; // reload app players after a save
}

// Batch "graduate seniors": pick roster players and move their app accounts to Alumni in one go.
// Alumni status lives on the app account, so roster players without an account can't be moved.
const GraduateSeniorsModal: React.FC<Props> = ({ appPlayers, onClose, onDone }) => {
  const accountByName = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of appPlayers) if (p.role === 'Player' && !p.mergedInto) map.set(normalizeName(p.name), p);
    return map;
  }, [appPlayers]);

  const rows = useMemo(() => ROSTER_PLAYERS.map(rp => {
    const account = accountByName.get(normalizeName(rp.name));
    return { rp, account, isSenior: rp.classYear === 'Senior' || rp.grade === 12 };
  }).sort((a, b) => Number(b.isSenior) - Number(a.isSenior) || a.rp.name.localeCompare(b.rp.name)), [accountByName]);

  const selectable = (r: typeof rows[number]) => !!r.account && !isAlumni(r.account);

  // Start with the roster's seniors ticked.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(rows.filter(r => r.isSenior && selectable(r)).map(r => r.rp.name)),
  );
  const [classYear, setClassYear] = useState(defaultAlumniClass());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());

  const shown = query.trim()
    ? rows.filter(r => r.rp.name.toLowerCase().includes(query.toLowerCase()))
    : rows;

  const toggle = (name: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const handleConfirm = async () => {
    const targets = rows.filter(r => selected.has(r.rp.name) && selectable(r));
    if (targets.length === 0) return;
    setSaving(true);
    setResult(null);
    const failed: string[] = [];
    for (const t of targets) {
      try {
        await db.setPlayerAlumni(t.account!.id, classYear);
      } catch (err) {
        console.error('[GraduateSeniorsModal] Could not move', t.rp.name, err);
        failed.push(t.rp.name);
      }
    }
    setSaving(false);
    const moved = targets.length - failed.length;
    setResult(failed.length === 0
      ? { success: true, message: `Moved ${moved} player${moved === 1 ? '' : 's'} to Alumni (Class of ${classYear})` }
      : { success: false, message: `Moved ${moved}; failed: ${failed.join(', ')}` });
    setSelected(new Set(failed));
    onDone();
  };

  const selectedCount = rows.filter(r => selected.has(r.rp.name) && selectable(r)).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-neutral-950 border border-neutral-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <GraduationCap size={20} className="text-purple-300" />
              Graduate Seniors
            </h2>
            <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white"><X size={20} /></button>
          </div>
          <p className="text-xs text-neutral-400 mb-3">
            Tick the players who graduated. They keep their account and records, move to the Alumni board, and leave the depth chart.
          </p>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search players..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto p-2">
          {shown.map(({ rp, account, isSenior }) => {
            const alreadyAlumni = !!account && isAlumni(account);
            const canPick = !!account && !alreadyAlumni;
            const checked = canPick && selected.has(rp.name);
            const photo = getPhotoUrl(rp.name);
            return (
              <button
                key={rp.name}
                type="button"
                disabled={!canPick}
                onClick={() => toggle(rp.name)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                  checked ? 'bg-purple-500/15' : 'hover:bg-neutral-900'
                } ${canPick ? '' : 'opacity-50 cursor-not-allowed'}`}
              >
                <div className={`w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center ${
                  checked ? 'bg-purple-500 border-purple-500' : 'border-neutral-600'
                }`}>
                  {checked && <CheckCircle size={14} className="text-white" />}
                </div>
                {photo && !brokenPhotos.has(rp.name) ? (
                  <img
                    src={photo}
                    alt=""
                    onError={() => setBrokenPhotos(prev => new Set(prev).add(rp.name))}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-neutral-800"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full flex-shrink-0 bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">
                    {rp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{rp.name}</div>
                  <div className="text-[11px] text-neutral-500">
                    {alreadyAlumni ? `Alumni · Class of ${account!.alumniClass}` : !account ? 'No app account' : rp.squad}
                  </div>
                </div>
                {isSenior && !alreadyAlumni && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex-shrink-0">Senior</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 space-y-3">
          {result && (
            <div className={`p-2 rounded-lg flex items-center gap-2 text-sm ${
              result.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {result.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {result.message}
            </div>
          )}
          <div className="flex items-center gap-2">
            <select
              value={classYear}
              onChange={e => setClassYear(parseInt(e.target.value))}
              className="px-2 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-white"
            >
              {Array.from({ length: 8 }, (_, i) => defaultAlumniClass() + 1 - i).map(y => (
                <option key={y} value={y}>Class of {y}</option>
              ))}
            </select>
            <button
              onClick={handleConfirm}
              disabled={saving || selectedCount === 0}
              className="flex-1 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving...' : `Move ${selectedCount} to Alumni`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraduateSeniorsModal;
