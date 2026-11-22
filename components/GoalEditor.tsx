import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { TeamGoal } from '../types';
import { db } from '../services/db';
import { LEVELS, TESTS, formatGap } from '../services/standards';
import { GOAL_REACH } from '../services/season';
import { goalSentence, localToday } from '../services/teamProgress';
import type { goalProgress } from '../services/improvement';

interface Props {
  goal: TeamGoal;
  coachName?: string;
  preview: (goal: TeamGoal) => ReturnType<typeof goalProgress>;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}

const LEVEL_BG = ['bg-orange-400', 'bg-slate-300', 'bg-amber-400', 'bg-amber-300'];

// Coaches set the team goal: players at a tier on one test by a date. Everyone sees it on the Team tab.
const GoalEditor: React.FC<Props> = ({ goal, coachName, preview, onCancel, onSaved }) => {
  const [draft, setDraft] = useState<TeamGoal>({ ...goal });
  const [countText, setCountText] = useState(goal.count ? String(goal.count) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<TeamGoal>) => setDraft(d => ({ ...d, ...patch }));
  const now = preview(draft);
  const countBad = countText !== '' && !(Number.isInteger(Number(countText)) && Number(countText) > 0);
  const pastDate = draft.by < localToday();
  const tier = LEVELS[draft.level];

  const handleSave = async () => {
    if (countBad || !draft.by) return;
    setSaving(true);
    setError(null);
    try {
      await db.saveTeamGoal({ ...draft, count: draft.count ?? null, setBy: coachName ?? 'Coach', updatedAt: Date.now() });
      await onSaved();
    } catch (e) {
      console.error('[GoalEditor] Could not save goal:', e);
      setError('Could not save the goal. Check your connection and try again.');
      setSaving(false);
    }
  };

  const field = 'mt-1 w-full min-h-[44px] px-3 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white';

  return (
    <div className="space-y-4">
      <button onClick={onCancel} className="flex items-center gap-2 min-h-[36px] text-sm text-neutral-400 hover:text-white">
        <ArrowLeft size={16} /> Team
      </button>
      <h2 className="text-xl font-black text-white">Team goal</h2>

      <p className="p-4 bg-amber-500/10 border border-amber-800 rounded-xl text-base font-bold text-white leading-relaxed">
        {goalSentence({ ...draft, count: draft.count ?? null })}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-neutral-400">Squad</span>
          <select value={draft.squad} onChange={e => set({ squad: e.target.value as TeamGoal['squad'] })} className={field}>
            <option value="All">Whole club</option>
            <option value="Varsity">Varsity</option>
            <option value="JV">JV</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-neutral-400">Test</span>
          <select value={draft.test} onChange={e => set({ test: e.target.value as TeamGoal['test'] })} className={field}>
            {TESTS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div>
        <span className="text-xs text-neutral-400">Tier (the line for each player's position)</span>
        <div className="mt-1 flex gap-1.5" role="group" aria-label="Tier">
          {LEVELS.map((l, i) => (
            <button key={l} onClick={() => set({ level: i as TeamGoal['level'] })} aria-pressed={draft.level === i}
              className={`flex-1 min-h-[44px] rounded-lg text-xs font-black ${draft.level === i ? `${LEVEL_BG[i]} text-black` : 'bg-neutral-900 border border-neutral-800 text-neutral-300'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-neutral-400">How many players</span>
          <input value={countText} inputMode="numeric" placeholder="Every player"
            onChange={e => {
              const t = e.target.value.replace(/\D/g, '').slice(0, 3);
              setCountText(t);
              set({ count: t ? Number(t) : null });
            }}
            className={`${field} ${countBad ? 'border-red-500' : ''} placeholder-neutral-500`} />
          <span className="mt-1 block text-[11px] text-neutral-500">Leave empty for every player</span>
        </label>
        <label className="block">
          <span className="text-xs text-neutral-400">By</span>
          <input type="date" value={draft.by} onChange={e => set({ by: e.target.value })} className={field} />
          {pastDate && <span className="mt-1 block text-[11px] text-amber-400">That date has passed.</span>}
        </label>
      </div>

      <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
        <p className="text-[11px] font-bold tracking-wider text-neutral-400">WHERE WE ARE NOW</p>
        <div className="h-2.5 bg-neutral-800 rounded-full overflow-hidden">
          <div className="h-2.5 bg-orange-400 rounded-full" style={{ width: `${now.target ? Math.min(100, (now.counted / now.target) * 100) : 0}%` }} />
        </div>
        <p className="text-sm text-neutral-200">
          {now.counted} of {now.target} already at {tier}
          {now.short.length > 0 && ` · ${now.withinReach} more within ${formatGap(draft.test, GOAL_REACH[draft.test])}`}
          {now.notRun.length > 0 && ` · ${now.notRun.length} not tested yet`}.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving} className="flex-1 min-h-[48px] rounded-xl bg-neutral-800 text-neutral-300 text-sm font-bold">Cancel</button>
        <button onClick={handleSave} disabled={saving || countBad || !draft.by}
          className="flex-[2] min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black disabled:opacity-40">
          {saving ? 'Saving…' : 'Set goal · everyone sees it on Team'}
        </button>
      </div>
    </div>
  );
};

export default GoalEditor;
