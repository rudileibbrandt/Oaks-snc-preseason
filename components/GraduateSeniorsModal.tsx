import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, CheckCircle, AlertTriangle } from 'lucide-react';
import { Player, RosterClass } from '../types';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { defaultAlumniClass, normalizeName } from '../services/alumni';
import { alumniClassOf, gradYearOf, setRosterAlumni } from '../services/classYears';
import RosterChecklist from './RosterChecklist';

interface Props {
  appPlayers: Player[];
  rosterClasses: Record<string, RosterClass>;
  onClose: () => void;
  onDone: () => void; // reload accounts and roster classes after a save
}

// Batch "graduate seniors": pick roster players and move them to Alumni in one go.
// Works with or without an app account; alumni rows can be restored.
const GraduateSeniorsModal: React.FC<Props> = ({ appPlayers, rosterClasses, onClose, onDone }) => {
  const accountByName = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of appPlayers) if (p.role === 'Player' && !p.mergedInto) map.set(normalizeName(p.name), p);
    return map;
  }, [appPlayers]);

  const [classYear, setClassYear] = useState(defaultAlumniClass());

  const rows = useMemo(() => ROSTER_PLAYERS.map(rp => {
    const account = accountByName.get(normalizeName(rp.name));
    const gradYear = gradYearOf(rp, rosterClasses);
    const alumniClass = alumniClassOf(rp.name, rosterClasses, account);
    return { rp, account, gradYear, alumniClass, inClass: gradYear === classYear };
  }).sort((a, b) =>
    Number(a.alumniClass !== undefined) - Number(b.alumniClass !== undefined)
    || Number(b.inClass) - Number(a.inClass)
    || a.rp.name.localeCompare(b.rp.name)),
  [accountByName, rosterClasses, classYear]);

  // Tick the chosen class. Re-ticked only when the year changes, so a save or restore
  // doesn't re-tick someone the coach just moved back.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set(rows.filter(r => r.inClass && r.alumniClass === undefined).map(r => r.rp.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classYear]);

  const [saving, setSaving] = useState(false);
  const [restoringName, setRestoringName] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const toggle = (name: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const targets = rows.filter(r => selected.has(r.rp.name) && r.alumniClass === undefined);

  const handleConfirm = async () => {
    if (targets.length === 0) return;
    setSaving(true);
    setResult(null);
    const failed: string[] = [];
    for (const t of targets) {
      try {
        await setRosterAlumni(t.rp.name, t.account, classYear);
      } catch (err) {
        console.error('[GraduateSeniorsModal] Could not move', t.rp.name, err);
        failed.push(t.rp.name);
      }
    }
    setSaving(false);
    setSelected(new Set(failed)); // keep only the ones that failed ticked
    const moved = targets.length - failed.length;
    setResult(failed.length === 0
      ? { success: true, message: `Moved ${moved} player${moved === 1 ? '' : 's'} to Alumni (Class of ${classYear})` }
      : { success: false, message: `Moved ${moved}; failed: ${failed.join(', ')}` });
    onDone();
  };

  const handleRestore = async (row: typeof rows[number]) => {
    setRestoringName(row.rp.name);
    setResult(null);
    try {
      await setRosterAlumni(row.rp.name, row.account, null);
      setSelected(prev => { const next = new Set(prev); next.delete(row.rp.name); return next; });
      setResult({ success: true, message: `Moved ${row.rp.name} back to the current team` });
    } catch (err) {
      console.error('[GraduateSeniorsModal] Could not restore', row.rp.name, err);
      setResult({ success: false, message: `Could not restore ${row.rp.name}` });
    } finally {
      setRestoringName(null);
      onDone();
    }
  };

  return (
    <RosterChecklist
      title={<><GraduationCap size={20} className="text-purple-300" />Graduate Seniors</>}
      intro="Tick the players who graduated. They keep their records, move to the Alumni board, and leave the depth chart. Works for players without an app account too."
      rows={rows.map(row => {
        const { rp, account, gradYear, alumniClass, inClass } = row;
        const isAlum = alumniClass !== undefined;
        return {
          name: rp.name,
          disabled: isAlum,
          sublabel: isAlum ? `Alumni · Class of ${alumniClass}` : `${rp.squad}${account ? '' : ' · no app account'}`,
          badge: isAlum ? undefined : inClass ? 'Senior' : gradYear ? `'${String(gradYear).slice(-2)}` : undefined,
          action: isAlum ? { label: 'Restore', onClick: () => handleRestore(row), busy: restoringName === rp.name } : undefined,
        };
      })}
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
            {saving ? 'Saving...' : `Move ${targets.length} to Alumni · Class of ${classYear}`}
          </button>
        </div>
      </>}
    />
  );
};

export default GraduateSeniorsModal;
