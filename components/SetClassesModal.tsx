import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle, AlertTriangle } from 'lucide-react';
import { Player, RosterClass } from '../types';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { db } from '../services/db';
import { normalizeName } from '../services/alumni';
import {
  classKey, classLabel, currentClassYears, gradYearOf, rosterAlumniNames,
  seniorClassYear, squadFromClass,
} from '../services/classYears';
import RosterChecklist from './RosterChecklist';

interface Props {
  appPlayers: Player[];
  rosterClasses: Record<string, RosterClass>;
  onClose: () => void;
  onDone: () => void; // reload class years after a save
}

// Pick a class year, tick its players, save. The class sets the squad (freshmen and sophomores are JV)
// and, for seniors, who Graduate Seniors ticks at the end of the year.
const SetClassesModal: React.FC<Props> = ({ appPlayers, rosterClasses, onClose, onDone }) => {
  const [classYear, setClassYear] = useState(seniorClassYear());
  const alumniNames = useMemo(() => rosterAlumniNames(appPlayers, rosterClasses), [appPlayers, rosterClasses]);

  // Current players only (alumni are done): this class first, then players with no class, then the rest.
  const rows = useMemo(() => ROSTER_PLAYERS
    .filter(rp => !alumniNames.has(normalizeName(rp.name)))
    .map(rp => ({ rp, gradYear: gradYearOf(rp, rosterClasses) }))
    .map(r => ({ ...r, order: r.gradYear === classYear ? 0 : r.gradYear === undefined ? 1 : 2 }))
    .sort((a, b) => a.order - b.order || a.rp.name.localeCompare(b.rp.name)),
  [alumniNames, rosterClasses, classYear]);

  // Ticks start as the chosen class; reset when the year changes or after a save reloads the data.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set(rows.filter(r => r.gradYear === classYear).map(r => r.rp.name)));
  }, [rows, classYear]);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const toggle = (name: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  // Only save what changed: newly ticked get this class; unticked members of this class are cleared.
  const added = rows.filter(r => selected.has(r.rp.name) && r.gradYear !== classYear);
  const removed = rows.filter(r => !selected.has(r.rp.name) && r.gradYear === classYear);
  const changes = added.length + removed.length;

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    const failed: string[] = [];
    for (const r of added) {
      try { await db.setRosterClass(classKey(r.rp.name), r.rp.name, { gradYear: classYear }); }
      catch (err) { console.error('[SetClassesModal] Save failed for', r.rp.name, err); failed.push(r.rp.name); }
    }
    for (const r of removed) {
      try { await db.setRosterClass(classKey(r.rp.name), r.rp.name, { gradYear: null }); }
      catch (err) { console.error('[SetClassesModal] Clear failed for', r.rp.name, err); failed.push(r.rp.name); }
    }
    setSaving(false);
    setResult(failed.length === 0
      ? { success: true, message: `Saved: ${selected.size} in the Class of ${classYear}` }
      : { success: false, message: `Could not save: ${failed.join(', ')}` });
    onDone();
  };

  return (
    <RosterChecklist
      title={<><Award size={20} className="text-amber-400" />Set Classes</>}
      intro="Pick a class, tick its players, save. Freshmen and sophomores go to JV, juniors and seniors to Varsity. Players with no class count as Varsity."
      rows={rows.map(({ rp, gradYear }) => ({
        name: rp.name,
        sublabel: gradYear === undefined ? 'No class yet' : `${classLabel(gradYear)} · ${squadFromClass(gradYear)}`,
        badge: gradYear === undefined ? 'No class' : gradYear !== classYear ? `'${String(gradYear).slice(-2)}` : undefined,
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
            onChange={e => { setClassYear(parseInt(e.target.value)); setResult(null); }}
            className="px-2 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-white"
          >
            {currentClassYears().map(y => <option key={y} value={y}>{classLabel(y)}</option>)}
          </select>
          <button
            onClick={handleSave}
            disabled={saving || changes === 0}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving...' : `Save ${selected.size} in Class of ${classYear}`}
          </button>
        </div>
      </>}
    />
  );
};

export default SetClassesModal;
