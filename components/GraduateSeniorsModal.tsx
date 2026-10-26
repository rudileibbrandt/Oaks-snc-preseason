import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, CheckCircle, AlertTriangle } from 'lucide-react';
import { Player } from '../types';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { db } from '../services/db';
import { isAlumni, defaultAlumniClass, normalizeName } from '../services/alumni';
import { gradYearOf } from '../services/classYears';
import RosterChecklist from './RosterChecklist';

interface Props {
  appPlayers: Player[];
  classYears: Record<string, number | null>;
  onClose: () => void;
  onDone: () => void; // reload app players after a save
}

// Batch "graduate seniors": pick roster players and move their app accounts to Alumni in one go.
// Alumni status lives on the app account, so roster players without an account can't be moved.
const GraduateSeniorsModal: React.FC<Props> = ({ appPlayers, classYears, onClose, onDone }) => {
  const accountByName = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of appPlayers) if (p.role === 'Player' && !p.mergedInto) map.set(normalizeName(p.name), p);
    return map;
  }, [appPlayers]);

  const [classYear, setClassYear] = useState(defaultAlumniClass());

  const rows = useMemo(() => ROSTER_PLAYERS.map(rp => {
    const account = accountByName.get(normalizeName(rp.name));
    const gradYear = gradYearOf(rp, classYears);
    return { rp, account, gradYear, inClass: gradYear === classYear };
  }).sort((a, b) => Number(b.inClass) - Number(a.inClass) || a.rp.name.localeCompare(b.rp.name)),
  [accountByName, classYears, classYear]);

  const selectable = (r: typeof rows[number]) => !!r.account && !isAlumni(r.account);

  // Tick the chosen class (re-ticked when the year changes).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set(rows.filter(r => r.inClass && selectable(r)).map(r => r.rp.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classYear, accountByName, classYears]);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const toggle = (name: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const targets = rows.filter(r => selected.has(r.rp.name) && selectable(r));

  const handleConfirm = async () => {
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
    onDone();
  };

  return (
    <RosterChecklist
      title={<><GraduationCap size={20} className="text-purple-300" />Graduate Seniors</>}
      intro="Tick the players who graduated. They keep their account and records, move to the Alumni board, and leave the depth chart."
      rows={rows.map(({ rp, account, gradYear, inClass }) => ({
        name: rp.name,
        disabled: !selectable({ rp, account, gradYear, inClass }),
        sublabel: account && isAlumni(account) ? `Alumni · Class of ${account.alumniClass}` : !account ? 'No app account' : rp.squad,
        badge: account && isAlumni(account) ? undefined : inClass ? 'Senior' : gradYear ? `'${String(gradYear).slice(-2)}` : undefined,
      }))}
      selected={selected}
      onToggle={toggle}
      onClose={onClose}
      footer={<>
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
            disabled={saving || targets.length === 0}
            className="flex-1 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving...' : `Move ${targets.length} to Alumni`}
          </button>
        </div>
      </>}
    />
  );
};

export default GraduateSeniorsModal;
