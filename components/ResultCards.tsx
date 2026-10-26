import React, { useMemo, useState } from 'react';
import { TestResult, TestSession } from '../types';
import { TESTING_SEASON_START } from '../services/season';
import { isoDate } from '../services/calendar';
import {
  LEVELS, PositionGroup, STANDARDS, TESTS, TestDef, BestScore, formatGap, formatProgress, formatStandard,
  formatValue, levelIndex, nextLevel, progressOf, testSummary,
} from '../services/standards';
import LevelChip, { CHIP, DOT } from './LevelChip';

interface Props {
  group: PositionGroup;
  results: TestResult[]; // one player's results
  sessions: TestSession[];
  wide?: boolean;        // two columns of cards on wider screens (coach detail)
}

const shortDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// A player's results, one card per test: tier (from best), best / worst / latest, progress,
// distance to the next tier, a dot per testing day, and every result on tap.
const ResultCards: React.FC<Props> = ({ group, results, sessions, wide }) => {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const season = useMemo(() => [...sessions]
    .filter(s => s.date >= TESTING_SEASON_START)
    .sort((a, b) => a.date.localeCompare(b.date)), [sessions]);
  const summaries = useMemo(() => Object.fromEntries(
    TESTS.map(t => [t.key, testSummary(results, sessions, t.key)])), [results, sessions]);

  const toggle = (key: string) => setOpen(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div className="space-y-2">
      <Tally group={group} summaries={summaries} season={season} results={results} />
      <div className={wide ? 'grid gap-2 md:grid-cols-2 items-start' : 'space-y-2'}>
        {TESTS.map(t => (
          <TestCard key={t.key} test={t} group={group} season={season} summary={summaries[t.key]}
            open={open.has(t.key)} onToggle={() => toggle(t.key)} />
        ))}
      </div>
    </div>
  );
};

// ---------- How many tests at each tier ----------

const Tally: React.FC<{
  group: PositionGroup;
  summaries: Record<string, ReturnType<typeof testSummary>>;
  season: TestSession[];
  results: TestResult[];
}> = ({ group, summaries, season, results }) => {
  const counts = new Map<number, number>();
  for (const t of TESTS) {
    const s = summaries[t.key];
    if (s) { const idx = levelIndex(group, t.key, s.best.value); counts.set(idx, (counts.get(idx) ?? 0) + 1); }
  }
  const today = isoDate(new Date());
  const held = season.filter(s => s.date <= today);
  const tested = held.filter(s => results.some(r => r.sessionId === s.id)).length;
  if (counts.size === 0) return null;
  return (
    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
      <p className="text-[11px] text-neutral-400">Tested {tested} of {held.length} testing day{held.length === 1 ? '' : 's'} so far this season</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {[3, 2, 1, 0, -1].filter(i => counts.has(i)).map(i => (
          <span key={i} className="flex items-center gap-1"><LevelChip idx={i} /><span className="text-xs text-neutral-400">× {counts.get(i)}</span></span>
        ))}
      </div>
    </div>
  );
};

// ---------- One test ----------

const TestCard: React.FC<{
  test: TestDef;
  group: PositionGroup;
  season: TestSession[];
  summary: ReturnType<typeof testSummary>;
  open: boolean;
  onToggle: () => void;
}> = ({ test, group, season, summary: s, open, onToggle }) => {
  const row = STANDARDS[group][test.key];
  const idx = s ? levelIndex(group, test.key, s.best.value) : null;
  const next = s ? nextLevel(group, test.key, s.best.value) : undefined;
  const progress = s ? progressOf(s, test.key) : undefined;
  // "Fitness testing · Baseline" → "Baseline"
  const short = (name: string) => name.split(' · ').pop() || name;
  const nameOf = (id: string) => short(season.find(x => x.id === id)?.name ?? 'Testing day');
  const today = isoDate(new Date());
  const byId = new Map(s?.list.map(x => [x.sessionId, x]) ?? []);

  const stat = (label: string, x: BestScore) => (
    <div className="bg-black/40 rounded-lg px-2 py-1.5 flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</span>
      <span className="text-sm font-bold text-white tabular-nums">{formatValue(test.key, x.value)}</span>
      <span><LevelChip idx={levelIndex(group, test.key, x.value)} small /></span>
    </div>
  );

  return (
    <div
      role={s ? 'button' : undefined}
      tabIndex={s ? 0 : undefined}
      aria-expanded={s ? open : undefined}
      onClick={s ? onToggle : undefined}
      onKeyDown={s ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
      className={`p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2 ${s ? 'cursor-pointer hover:border-neutral-700' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-white font-bold text-sm">{test.label}</p>
        {idx !== null ? <LevelChip idx={idx} /> : <span className="text-xs text-neutral-500">Not tested</span>}
      </div>

      {s ? (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {stat('Best', s.best)}{stat('Worst', s.worst)}{stat('Latest', s.latest)}
          </div>
          <p className="text-[11px] text-neutral-400">
            {progress
              ? progress.amount === 0
                ? <>No change since {nameOf(progress.since)}</>
                : <><span className={progress.improved ? 'text-green-400' : 'text-red-400'}>{progress.improved ? '▲' : '▼'} {formatProgress(test.key, progress)}</span> since {nameOf(progress.since)}</>
              : 'One result so far'}
            {' · '}
            <span className="text-amber-400">{next ? `${formatGap(test.key, next.gap)} to ${next.level}` : 'top tier'}</span>
          </p>
        </>
      ) : (
        <p className="text-[11px] text-neutral-500">No result yet. The lines below are what to aim for.</p>
      )}

      <div className="grid grid-cols-4 gap-1">
        {LEVELS.map((lvl, i) => (
          <div key={lvl} className={`text-center rounded-md py-1 ${idx !== null && idx >= i ? CHIP[i] : 'bg-black/40 text-neutral-500'}`}>
            <div className="text-[9px] uppercase tracking-wide">{lvl}</div>
            <div className="text-[11px] font-bold tabular-nums">{formatStandard(test.key, row[i])}</div>
          </div>
        ))}
      </div>

      {season.length > 0 && (
        <div className="grid gap-1 border-t border-neutral-800 pt-2" style={{ gridTemplateColumns: `repeat(${season.length}, minmax(0, 1fr))` }}>
          {season.map(ss => {
            const x = byId.get(ss.id);
            const upcoming = !x && ss.date >= today;
            return (
              <div key={ss.id} className="flex flex-col items-center gap-0.5 text-[10px] text-neutral-500 text-center">
                {x
                  ? <span className={`w-3 h-3 rounded-full ${DOT[levelIndex(group, test.key, x.value)]}`} />
                  : <span className={`w-3 h-3 rounded-full border-[1.5px] border-neutral-600 ${upcoming ? 'border-dashed' : ''}`} />}
                <span className="text-neutral-200 tabular-nums">{x ? formatValue(test.key, x.value) : upcoming ? '' : '–'}</span>
                <span>{shortDate(ss.date)}</span>
              </div>
            );
          })}
        </div>
      )}

      {s && open && (
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-neutral-500 text-left border-b border-neutral-800">
              <th className="font-medium py-1">Testing day</th><th className="font-medium py-1">Result</th><th className="font-medium py-1">Tier</th>
            </tr>
          </thead>
          <tbody>
            {season.filter(ss => byId.has(ss.id) || ss.date < today).map(ss => {
              const x = byId.get(ss.id);
              return (
                <tr key={ss.id} className="border-b border-neutral-800/60">
                  <td className="py-1.5 text-neutral-200">{short(ss.name)} <span className="text-neutral-500">· {shortDate(ss.date)}</span></td>
                  {x ? (
                    <>
                      <td className="py-1.5 text-white">
                        {formatValue(test.key, x.value)}
                        {x === s.best && <Tag className="bg-green-900/50 text-green-400">Best</Tag>}
                        {x === s.worst && s.list.length > 1 && <Tag className="bg-red-900/40 text-red-400">Worst</Tag>}
                        {x === s.latest && <Tag className="bg-neutral-800 text-neutral-400">Latest</Tag>}
                      </td>
                      <td className="py-1.5"><LevelChip idx={levelIndex(group, test.key, x.value)} small /></td>
                    </>
                  ) : <><td className="py-1.5 text-neutral-500">Missed</td><td /></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {s && <p className="text-[10px] text-neutral-600 text-right">{open ? 'Tap to close' : 'Tap for every result'}</p>}
    </div>
  );
};

const Tag: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={`ml-1 text-[9px] font-bold uppercase tracking-wide px-1 py-px rounded ${className}`}>{children}</span>
);

export default ResultCards;
