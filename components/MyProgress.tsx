import React, { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { TeamGoal, TestResult, TestSession } from '../types';
import {
  LEVELS, PositionGroup, TESTS, formatGap, formatProgress, formatValue, groupLabel, levelIndex, nextLevel, progressOf, testSummary,
} from '../services/standards';
import { playerImprovement } from '../services/improvement';
import { LOWER, daysUntil, fmtPct, goalByLabel, goalLine, localToday, nextTestingDay, seriesOf, shortDay } from '../services/teamProgress';
import LevelChip from './LevelChip';

// The next testing day. Players capture their own scores whenever they can (Rudi, 22 Nov 2026),
// so the banner tells them to; coaches get a Start button on the day.
export const NextTestingBanner: React.FC<{ sessions: TestSession[]; isCoach?: boolean; onStart?: (sessionId: string) => void }> = ({ sessions, isCoach, onStart }) => {
  const next = nextTestingDay(sessions);
  if (!next) return null;
  const days = daysUntil(next.date);
  const today = next.date === localToday();
  const body = (
    <>
      <span className="flex flex-col gap-0.5 text-left">
        <span className="text-sm font-black flex items-center gap-1.5"><CalendarClock size={15} />{today ? `Testing today · ${shortDay(next.date)}` : `Testing ${shortDay(next.date)}`}</span>
        <span className="text-xs font-medium">{isCoach ? (today ? 'Open it and pick your station.' : next.name) : (today ? 'Capture your scores in the app as you test.' : 'Capture your scores in the app on the day.')}</span>
      </span>
      <span className="text-sm font-black flex-shrink-0">{today ? (isCoach ? 'Start' : 'Today') : `${days} day${days === 1 ? '' : 's'}`}</span>
    </>
  );
  return isCoach && today && onStart ? (
    <button onClick={() => onStart(next.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl">{body}</button>
  ) : (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-500 text-black rounded-xl">{body}</div>
  );
};

// A PR = the latest result is better than every earlier one this season.
const latestIsPR = (list: { value: number }[], lowerIsBetter: boolean) => {
  if (list.length < 2) return false;
  const last = list[list.length - 1].value;
  return list.slice(0, -1).every(x => (lowerIsBetter ? last < x.value : last > x.value));
};

// The top of a player's Me tab: the team goal's test, then improvement on the other tests.
const MyProgress: React.FC<{ group: PositionGroup; results: TestResult[]; sessions: TestSession[]; goal: TeamGoal }> = ({ group, results, sessions, goal }) => {
  const series = useMemo(() => seriesOf(results, sessions), [results, sessions]);
  const imp = useMemo(() => playerImprovement(series, LOWER), [series]);
  const test = goal.test;
  const testDef = TESTS.find(t => t.key === test)!;
  const tier = LEVELS[goal.level];
  const summary = testSummary(results, sessions, test);
  const line = goalLine(goal, group);
  const best = summary?.best.value;
  const idx = best !== undefined ? levelIndex(group, test, best) : -1;
  const next = best !== undefined ? nextLevel(group, test, best) : undefined;
  const goalProgress = summary ? progressOf(summary, test) : undefined;
  const others = TESTS.filter(t => t.key !== test);

  return (
    <div className="space-y-3">
      <div className="p-4 bg-amber-500/10 border border-amber-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold tracking-wider text-amber-400">{testDef.label.toUpperCase()} · TEAM GOAL</p>
          <p className="text-xs text-amber-300">{tier} by {goalByLabel(goal.by)}{goal.squad !== 'All' ? ` · ${goal.squad}` : ''}</p>
        </div>
        {best === undefined ? (
          <p className="text-sm text-neutral-200">
            No {testDef.label} result yet this season. {tier} for {groupLabel(group).split(' · ')[0].toLowerCase()} is <b className="text-white">{formatValue(test, line)}</b>.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0"><LevelChip idx={idx} /></div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-3xl font-black text-white leading-none tabular-nums">{formatValue(test, best)}</p>
              <p className="text-sm font-bold text-white">
                {idx >= goal.level ? `You're counted: you hit ${tier}.` : `${formatGap(test, Math.abs(best - line))} to ${tier} (${formatValue(test, line)}).`}
              </p>
              {idx >= goal.level && next && <p className="text-xs text-neutral-300">{next.level}: {formatValue(test, next.line)} · {formatGap(test, next.gap)} to go</p>}
              {goalProgress && goalProgress.amount > 0 && (
                <p className={`text-xs font-bold ${goalProgress.improved ? 'text-amber-300' : 'text-sky-300'}`}>
                  {goalProgress.improved ? '▲' : '▼'} {formatProgress(test, goalProgress)} than your first test
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold tracking-wider text-neutral-400">EVERYTHING ELSE · GETTING BETTER?</p>
        {imp.overall !== undefined && <p className="text-sm font-black text-amber-500">{fmtPct(imp.overall)} overall</p>}
      </div>
      <div className="space-y-1.5">
        {others.map(t => {
          const s = testSummary(results, sessions, t.key);
          const p = s ? progressOf(s, t.key) : undefined;
          const pct = imp.perTest[t.key];
          return (
            <div key={t.key} className="flex items-center gap-3 px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg">
              <span className="flex-1 min-w-0 text-sm text-white font-medium">
                {t.label}
                {s && latestIsPR(s.list, t.lowerIsBetter) && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500 text-black text-[10px] font-black">PR</span>}
              </span>
              <span className="text-sm text-white font-bold tabular-nums">{s ? formatValue(t.key, s.latest) : '—'}</span>
              <span className={`w-28 text-right text-xs font-bold ${!p ? 'text-neutral-500' : p.amount === 0 ? 'text-neutral-400' : p.improved ? 'text-amber-500' : 'text-sky-300'}`}>
                {!s ? 'not tested' : !p ? 'first test' : p.amount === 0 ? 'same' : `${p.improved ? '▲' : '▼'} ${pct !== undefined ? fmtPct(Math.abs(pct)).replace('+', '') : formatProgress(t.key, p)}`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-neutral-500">
        Change is your latest result vs your first test this season; overall is the average across tests you've done twice.
        Your full results and tiers for every test are below.
      </p>
    </div>
  );
};

export default MyProgress;
