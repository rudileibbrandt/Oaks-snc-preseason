import React from 'react';
import { Highlighter } from 'lucide-react';
import { LEVELS, StandardTest, TESTS } from '../services/standards';
import { DOT } from './LevelChip';

// The Board's highlight filter (Rudi, 22 Nov 2026): pick one test, and the Board highlights the
// players short of the tier line on it (Bronze unless changed), or the players with no result on it
// ("Not tested"). Names stay white. Off by default.
export interface Highlight {
  test: StandardTest | null;  // null = off
  show: 'short' | 'untested'; // below the tier line, or no result on the test
  level: 0 | 1 | 2 | 3;       // short of this tier is highlighted
  onlyFlagged: boolean;       // hide everyone else
}

export const DEFAULT_HIGHLIGHT: Highlight = { test: null, show: 'short', level: 0, onlyFlagged: false };

const KEY = 'oaks_board_highlight_v2';
// The coach's last choice, on this device only. Storage can be blocked (private mode): then it just resets.
export const loadHighlight = (): Highlight => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!saved) return DEFAULT_HIGHLIGHT;
    const valid = TESTS.some(t => t.key === saved.test);
    return { ...DEFAULT_HIGHLIGHT, ...saved, test: valid ? saved.test : null, show: saved.show === 'untested' ? 'untested' : 'short' };
  } catch { return DEFAULT_HIGHLIGHT; }
};
export const saveHighlight = (h: Highlight) => { try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* not kept */ } };

export const SHORT: Record<StandardTest, string> = {
  bronco: 'Bronco', sprint10: '10 m', sprint40: '40 m', broadJump: 'Broad', chinup: 'Chin-up', chinupReps: 'Chin reps', squat3rm: 'Squat',
};

const chip = (on: boolean) =>
  `min-h-[34px] px-3 rounded-full text-xs font-bold border transition-colors ${on
    ? 'bg-red-500/15 border-red-500/60 text-red-200'
    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'}`;

const BoardHighlight: React.FC<{
  value: Highlight; onChange: (h: Highlight) => void; short: number; untested: number; changeMode: boolean;
}> = ({ value: h, onChange, short, untested, changeMode }) => {
  const set = (patch: Partial<Highlight>) => onChange({ ...h, ...patch });
  const on = h.test !== null;

  return (
    <div className={`rounded-xl border p-3 space-y-2.5 transition-colors ${on ? 'bg-red-950/20 border-red-900/60' : 'bg-neutral-900 border-neutral-800'}`}>
      <div className="flex items-center gap-2">
        <Highlighter size={15} className={on ? 'text-red-400' : 'text-neutral-500'} />
        <p className="flex-1 min-w-0 text-sm font-bold text-white">Highlight who's short</p>
        {on && (
          <button type="button" onClick={() => set({ test: null })} className="text-[11px] text-neutral-400 hover:text-white min-h-[28px] px-1">Off</button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Test to highlight">
        {TESTS.map(t => (
          <button key={t.key} type="button" role="radio" aria-checked={h.test === t.key}
            onClick={() => set({ test: h.test === t.key ? null : t.key })} className={chip(h.test === t.key)}>
            {SHORT[t.key]}
          </button>
        ))}
      </div>

      {on && (
        <>
          <div className="grid grid-cols-2 gap-1 bg-neutral-950 rounded-lg p-0.5 border border-neutral-800" role="radiogroup" aria-label="Who to highlight">
            {([['short', `Below ${LEVELS[h.level]}`, short, 'text-red-300'], ['untested', 'Not tested', untested, 'text-sky-300']] as const).map(([k, label, n, tone]) => (
              <button key={k} type="button" role="radio" aria-checked={h.show === k} onClick={() => set({ show: k })}
                className={`min-h-[34px] rounded-md text-xs font-bold flex items-center justify-center gap-1.5 ${h.show === k ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}>
                {label}<span className={`tabular-nums ${h.show === k ? tone : ''}`}>{n}</span>
              </button>
            ))}
          </div>
          {h.show === 'short' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold tracking-wider text-neutral-400">LINE</span>
              <div className="flex gap-1 bg-neutral-950 rounded-lg p-0.5 border border-neutral-800" role="radiogroup" aria-label="Tier line">
                {LEVELS.map((l, i) => (
                  <button key={l} type="button" role="radio" aria-checked={h.level === i} onClick={() => set({ level: i as Highlight['level'] })}
                    className={`min-h-[30px] px-2.5 rounded-md text-xs font-bold flex items-center gap-1.5 ${h.level === i ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${DOT[i]}`} />{l}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <p className="flex-1 min-w-0 text-[11px] text-neutral-400">
              {h.show === 'short'
                ? <>Below {LEVELS[h.level]} on {SHORT[h.test!]}{changeMode ? ', judged on best results' : ''}.</>
                : <>No {SHORT[h.test!]} result this season, incl. players with no tests at all.</>}
            </p>
            <button type="button" role="switch" aria-checked={h.onlyFlagged} onClick={() => set({ onlyFlagged: !h.onlyFlagged })}
              className={`flex-shrink-0 ${chip(h.onlyFlagged)}`}>Only show them</button>
          </div>
        </>
      )}
    </div>
  );
};

export default BoardHighlight;
