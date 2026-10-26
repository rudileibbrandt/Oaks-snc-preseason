import React, { useMemo, useState } from 'react';
import { Award, CheckCircle, AlertTriangle } from 'lucide-react';
import { Player } from '../types';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { db } from '../services/db';
import { isAlumni, normalizeName } from '../services/alumni';
import { classKey, gradYearOf, seniorClassYear } from '../services/classYears';
import RosterChecklist from './RosterChecklist';

interface Props {
  appPlayers: Player[];
  classYears: Record<string, number | null>;
  onClose: () => void;
  onDone: () => void; // reload class years after a save
}

// Tick this school year's seniors. Saves their graduation year, so "Senior" rolls over by itself.
const MarkSeniorsModal: React.FC<Props> = ({ appPlayers, classYears, onClose, onDone }) => {
  const seniorClass = seniorClassYear();
  const alumniNames = useMemo(
    () => new Set(appPlayers.filter(isAlumni).map(p => normalizeName(p.name))),
    [appPlayers],
  );

  // Current players only (alumni are done), seniors first.
  const rows = useMemo(() => ROSTER_PLAYERS
    .filter(rp => !alumniNames.has(normalizeName(rp.name)))
    .map(rp => ({ rp, gradYear: gradYearOf(rp, classYears) }))
    .sort((a, b) => Number(b.gradYear === seniorClass) - Number(a.gradYear === seniorClass) || a.rp.name.localeCompare(b.rp.name)),
  [alumniNames, classYears, seniorClass]);

  const initial = useMemo(() => new Set(rows.filter(r => r.gradYear === seniorClass).map(r => r.rp.name)), [rows, seniorClass]);
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const toggle = (name: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  // Only save what changed: newly ticked get this class; unticked seniors are cleared.
  const added = rows.filter(r => selected.has(r.rp.name) && r.gradYear !== seniorClass);
  const removed = rows.filter(r => !selected.has(r.rp.name) && r.gradYear === seniorClass);
  const changes = added.length + removed.length;

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    const failed: string[] = [];
    for (const r of added) {
      try { await db.setClassYear(classKey(r.rp.name), r.rp.name, seniorClass); }
      catch (err) { console.error('[MarkSeniorsModal] Save failed for', r.rp.name, err); failed.push(r.rp.name); }
    }
    for (const r of removed) {
      try { await db.setClassYear(classKey(r.rp.name), r.rp.name, null); }
      catch (err) { console.error('[MarkSeniorsModal] Clear failed for', r.rp.name, err); failed.push(r.rp.name); }
    }
    setSaving(false);
    setResult(failed.length === 0
      ? { success: true, message: `Saved: ${selected.size} senior${selected.size === 1 ? '' : 's'} (Class of ${seniorClass})` }
      : { success: false, message: `Could not save: ${failed.join(', ')}` });
    onDone();
  };

  return (
    <RosterChecklist
      title={<><Award size={20} className="text-amber-400" />Mark Seniors · Class of {seniorClass}</>}
      intro="Tick this year's seniors. At the end of the season, Graduate Seniors will have them ticked."
      rows={rows.map(({ rp, gradYear }) => ({
        name: rp.name,
        sublabel: rp.squad,
        badge: gradYear && gradYear !== seniorClass ? `'${String(gradYear).slice(-2)}` : undefined,
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
        <button
          onClick={handleSave}
          disabled={saving || changes === 0}
          className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving...' : `Save ${selected.size} senior${selected.size === 1 ? '' : 's'}`}
        </button>
      </>}
    />
  );
};

export default MarkSeniorsModal;
