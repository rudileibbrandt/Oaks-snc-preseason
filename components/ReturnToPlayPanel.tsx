import React, { useState } from 'react';
import { Check, Lock, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { InjuryRecord, Player } from '../types';
import { db } from '../services/db';
import { invalidateInjuryCache } from '../services/injuryData';
import { rtpState, checkStageMove, stageMoveUpdate, checkClearance, needsClearance, todayIso } from '../services/returnToPlay';

interface Props {
  injury: InjuryRecord;
  currentPlayer: Player; // a coach
  onChanged: (updated: InjuryRecord) => void;
}

// Read YYYY-MM-DD as a local date (new Date('2026-11-02') is UTC midnight, which shows as Nov 1 here).
const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Coaches move an injured player through the return-to-play stages and record the medical clearance.
// Each change saves straight away.
const ReturnToPlayPanel: React.FC<Props> = ({ injury, currentPlayer, onChanged }) => {
  const [picked, setPicked] = useState<string | null>(null); // stage waiting for confirm
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearance, setShowClearance] = useState(false);
  const [provider, setProvider] = useState('');
  const [clearanceDate, setClearanceDate] = useState(todayIso());

  const today = todayIso();
  const state = rtpState(injury, today);
  const pickedDef = state.stages.find(s => s.key === picked);

  const save = async (...args: Parameters<typeof db.appendInjuryEntry>) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await db.appendInjuryEntry(...args);
      if (!updated) throw new Error('Injury record not found');
      invalidateInjuryCache();
      onChanged(updated);
      return true;
    } catch (e) {
      console.error('[ReturnToPlayPanel] save failed', e);
      setError('Could not save. Check your connection and try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePickStage = (key: string) => {
    const problem = checkStageMove(injury, key);
    setError(problem);
    setPicked(problem ? null : key);
  };

  const handleConfirmStage = async () => {
    if (!picked) return;
    const { entry, fields } = stageMoveUpdate(injury, picked, currentPlayer.name, today, Date.now());
    if (await save(injury.id, 'rtpStages', entry, fields)) setPicked(null);
  };

  const handleSaveClearance = async () => {
    const problem = checkClearance(provider, clearanceDate, today, injury.dateOfInjury);
    if (problem) { setError(problem); return; }
    const ok = await save(injury.id, 'clearances', {
      date: clearanceDate, provider: provider.trim(), recordedBy: currentPlayer.name, at: Date.now(),
    });
    if (ok) { setShowClearance(false); setProvider(''); }
  };

  const inputClass = 'w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-2 text-white text-sm focus:border-amber-500 outline-none';

  return (
    <div className="mt-3 p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Return to play</p>
        <p className="text-[11px] text-neutral-500">{state.concussion ? 'Concussion protocol' : 'Standard stages'}</p>
      </div>

      {state.active && !state.current && (
        <p className="mt-2 text-xs text-amber-400">No stage set yet. Tap the stage the player is on now.</p>
      )}

      <ol className="mt-2 space-y-1">
        {state.stages.map((s, i) => {
          const isCurrent = state.current?.index === i;
          const isDone = state.current ? i < state.current.index : false;
          const locked = needsClearance(state, s);
          return (
            <li key={s.key}>
              <button
                onClick={() => state.active && !isCurrent && handlePickStage(s.key)}
                disabled={!state.active || isCurrent || saving}
                className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left border ${
                  isCurrent ? 'border-amber-500 bg-amber-500/10' : picked === s.key ? 'border-amber-500/60 border-dashed' : 'border-transparent hover:bg-neutral-800'
                }`}
              >
                <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isDone ? 'bg-green-500/20 text-green-400' : isCurrent ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {isDone ? <Check size={12} /> : i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm ${isCurrent ? 'text-white font-bold' : isDone ? 'text-neutral-400' : 'text-neutral-200'}`}>{s.name}</span>
                  <span className="block text-[11px] text-neutral-500">
                    {isCurrent && state.current
                      ? `Since ${shortDate(state.current.startedOn)} · day ${state.current.daysOn + 1}`
                      : s.detail}
                  </span>
                </span>
                {locked && <Lock size={12} className="mt-1 text-red-400 shrink-0" aria-label="Needs clearance" />}
              </button>
            </li>
          );
        })}
      </ol>

      {pickedDef && (
        <div className="mt-2 flex items-center gap-2">
          <p className="flex-1 text-xs text-neutral-300">Move to <span className="text-amber-400 font-bold">{pickedDef.name}</span>?</p>
          <button onClick={handleConfirmStage} disabled={saving} className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold disabled:opacity-50 flex items-center gap-1">
            {saving && <Loader2 size={12} className="animate-spin" />} Confirm
          </button>
          <button onClick={() => setPicked(null)} disabled={saving} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs">Cancel</button>
        </div>
      )}

      {/* Clearance */}
      <div className="mt-3 pt-3 border-t border-neutral-800">
        {state.clearance ? (
          <p className="text-xs text-green-400 flex items-center gap-1.5">
            <ShieldCheck size={14} /> Cleared by {state.clearance.provider} on {shortDate(state.clearance.date)}
            {(injury.clearances?.length ?? 0) > 1 && <span className="text-neutral-500">({injury.clearances!.length} on file)</span>}
          </p>
        ) : (
          <p className={`text-xs flex items-center gap-1.5 ${state.concussion ? 'text-red-400' : 'text-neutral-500'}`}>
            <ShieldAlert size={14} />
            {state.concussion ? 'No medical clearance on file. Needed before any contact.' : 'No medical clearance on file.'}
          </p>
        )}

        {showClearance ? (
          <div className="mt-2 space-y-2">
            <label className="block">
              <span className="text-[11px] text-neutral-400">Signed by (name and practice)</span>
              <input value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. Dr Patel, Kaiser Walnut Creek" className={inputClass} />
            </label>
            <label className="block">
              <span className="text-[11px] text-neutral-400">Date on the clearance</span>
              <input type="date" value={clearanceDate} max={today} onChange={e => setClearanceDate(e.target.value)} className={inputClass} />
            </label>
            <div className="flex gap-2">
              <button onClick={handleSaveClearance} disabled={saving} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1">
                {saving && <Loader2 size={14} className="animate-spin" />} Save clearance
              </button>
              <button onClick={() => setShowClearance(false)} disabled={saving} className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm">Cancel</button>
            </div>
          </div>
        ) : state.active && (
          <button onClick={() => { setShowClearance(true); setError(null); }} className="mt-2 text-xs text-amber-500 font-medium hover:text-amber-400">
            {state.clearance ? 'Record a newer clearance' : 'Record clearance'}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
};

export default ReturnToPlayPanel;
