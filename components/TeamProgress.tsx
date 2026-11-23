import React, { useMemo, useState } from 'react';
import { Loader2, Pencil, Target, TrendingUp } from 'lucide-react';
import { TeamGoal, TestResult, TestSession } from '../types';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { normalizeName } from '../services/alumni';
import { useAlumniNames } from '../hooks/useAlumniNames';
import { useRosterClasses } from '../hooks/useRosterContext';
import { classKey } from '../services/classYears';
import { LEVELS, TESTS, formatBronco, formatGap, formatValue, playerGroup } from '../services/standards';
import { GOAL_REACH, TESTING_SEASON_START } from '../services/season';
import { goalProgress, playerImprovement, sessionPRs, teamImprovement, teamTotals } from '../services/improvement';
import { LOWER, TEST_KEYS, bestOf, fmtPct, goalLine, goalSentence, lastTestingDay, seriesOf, shortDay } from '../services/teamProgress';
import GoalEditor from './GoalEditor';

interface Props {
  sessions: TestSession[];
  results: TestResult[];
  isCoach: boolean;
  goal: TeamGoal;
  onGoalSaved: () => Promise<void>;
  coachName?: string;
}

type PlayerRow = { name: string; squad: string; series: ReturnType<typeof seriesOf>; group: ReturnType<typeof playerGroup> };

// Where the team stands on a goal (also used for the live preview while a coach edits it).
export const goalStatus = (goal: TeamGoal, players: PlayerRow[]) => goalProgress(
  players.filter(p => goal.squad === 'All' || p.squad === goal.squad)
    .map(p => ({ name: p.name, best: bestOf(p.series[goal.test], LOWER[goal.test]), line: goalLine(goal, p.group) })),
  { lowerIsBetter: LOWER[goal.test], reach: GOAL_REACH[goal.test], count: goal.count },
);

const seasonStartLabel = new Date(TESTING_SEASON_START + 'T12:00:00')
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// The Team tab: the Bronco goal, how much the team has improved, and PRs. Players see counts
// only; coaches also see who is short of Bronze and who went backwards.
const TeamProgress: React.FC<Props> = ({ sessions, results, isCoach, goal: teamGoal, onGoalSaved, coachName }) => {
  const { isAlumniName, ready: alumniReady } = useAlumniNames();
  const { positionsOf, squadInfo, classes, ready: classesReady } = useRosterClasses();
  const [showAllShort, setShowAllShort] = useState(false);
  const [editing, setEditing] = useState(false);
  // Varsity and JV side by side (Rudi, 22 Nov 2026). The goal card keeps its own squad.
  const [squad, setSquad] = useState<'All' | 'Varsity' | 'JV'>('All');

  const data = useMemo(() => {
    const byPlayer = new Map<string, TestResult[]>();
    for (const r of results) byPlayer.set(r.nameKey, [...(byPlayer.get(r.nameKey) ?? []), r]);
    // The current team: on a SportsEngine squad, or put on one by a coach (47 in Nov 2026). The
    // roster file also holds past players with no squad; they don't count toward the goal.
    const players = ROSTER_PLAYERS
      .filter(p => !isAlumniName(p.name) && (p.squad || classes[classKey(p.name)]?.squad)).map(p => {
      const mine = byPlayer.get(normalizeName(p.name)) ?? [];
      const series = seriesOf(mine, sessions);
      const group = playerGroup(mine, sessions, positionsOf(p).best);
      return { name: p.name, squad: squadInfo(p).squad, series, group, imp: playerImprovement(series, LOWER) };
    });
    return { players, last: lastTestingDay(sessions, results) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, sessions, alumniReady, classesReady, classes]);

  // Improvement, PRs, totals and who went backwards, for the squad picked.
  const view = useMemo(() => {
    const shown = data.players.filter(p => squad === 'All' || p.squad === squad);
    const team = teamImprovement(shown.map(p => p.imp), TEST_KEYS);
    const prs = data.last ? sessionPRs(shown.map(p => ({ name: p.name, series: p.series })), data.last.date, LOWER) : undefined;
    const totals = teamTotals(shown.map(p => p.series));
    const backwards = shown.filter(p => Object.values(p.imp.perTest).filter(v => v !== undefined && v < 0).length >= 2).map(p => p.name);
    return { team, prs, totals, backwards };
  }, [data, squad]);

  if (!alumniReady || !classesReady) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-neutral-500" /></div>;

  const { players, last } = data;
  const { team, prs, totals, backwards } = view;
  const goal = goalStatus(teamGoal, players);
  const goalPct = goal.target ? Math.min(100, Math.round((goal.counted / goal.target) * 100)) : 0;
  const testLabel = TESTS.find(t => t.key === teamGoal.test)!.label;
  const tier = LEVELS[teamGoal.level];

  if (editing) {
    return <GoalEditor goal={teamGoal} coachName={coachName} preview={g => goalStatus(g, players)}
      onCancel={() => setEditing(false)} onSaved={async () => { await onGoalSaved(); setEditing(false); }} />;
  }
  const maxPct = Math.max(1, ...TEST_KEYS.map(k => Math.abs(team.perTest[k]?.median ?? 0)));
  const shortShown = showAllShort ? goal.short : goal.short.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="p-4 bg-amber-500/10 border border-amber-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold tracking-wider text-amber-400 flex items-center gap-1.5"><Target size={13} /> TEAM GOAL</p>
          {isCoach && (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 min-h-[32px] px-2 text-xs font-bold text-amber-400 hover:text-white">
              <Pencil size={12} /> Change goal
            </button>
          )}
        </div>
        <p className="text-lg font-black text-white leading-snug">{goalSentence(teamGoal)}</p>
        <div className="h-3 bg-amber-950 rounded-full overflow-hidden" role="progressbar" aria-valuenow={goal.counted} aria-valuemin={0} aria-valuemax={goal.target}>
          <div className={`h-3 rounded-full ${goal.met ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${goalPct}%` }} />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white font-bold">{goal.counted} of {goal.target} players</span>
          <span className={goal.met ? 'text-green-400 font-bold' : 'text-amber-300'}>{goal.met ? 'Goal reached' : `${goal.target - goal.counted} to go`}</span>
        </div>
        <p className="text-xs text-neutral-300">
          {goal.withinReach} of the {goal.short.length} who have done it are within {formatGap(teamGoal.test, GOAL_REACH[teamGoal.test])} of {tier}.
          {goal.notRun.length > 0 && ` ${goal.notRun.length} haven't done it yet.`}
        </p>
      </div>

      {isCoach && goal.short.length > 0 && (
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
          <p className="text-[11px] font-bold tracking-wider text-neutral-400">{testLabel.toUpperCase()} · NOT AT {tier.toUpperCase()} YET · CLOSEST FIRST <span className="text-neutral-500 font-normal">(coaches only)</span></p>
          {shortShown.map(s => (
            <div key={s.name} className="flex justify-between text-sm">
              <span className="text-white">{s.name}</span>
              <span className="text-amber-300 tabular-nums">{formatValue(teamGoal.test, s.best)} · {formatGap(teamGoal.test, s.gap)} to {tier}</span>
            </div>
          ))}
          {goal.short.length > 5 && (
            <button onClick={() => setShowAllShort(v => !v)} className="text-xs text-amber-500 hover:text-amber-400 min-h-[32px]">
              {showAllShort ? 'Show fewer' : `Show all ${goal.short.length}`}
            </button>
          )}
          {goal.notRun.length > 0 && <p className="text-xs text-neutral-500">Not done yet: {goal.notRun.join(', ')}</p>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-wider text-neutral-400">SQUAD</span>
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800" role="radiogroup" aria-label="Squad">
          {(['All', 'Varsity', 'JV'] as const).map(s => (
            <button key={s} type="button" role="radio" aria-checked={squad === s} onClick={() => setSquad(s)}
              className={`min-h-[32px] px-3 text-xs font-bold rounded-md flex items-center gap-1.5 ${squad === s ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}>
              <span className={`w-2.5 h-2.5 rounded-full border-2 ${squad === s ? 'border-black bg-black/80' : 'border-neutral-500'}`} />{s}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold tracking-wider text-neutral-400 flex items-center gap-1.5"><TrendingUp size={13} /> {squad === 'All' ? 'TEAM' : squad.toUpperCase()} IMPROVEMENT SINCE {seasonStartLabel.toUpperCase()}</p>
          {team.overall && <span className="text-xl font-black text-amber-500">{fmtPct(team.overall.median)}</span>}
        </div>
        {TESTS.map(t => {
          const s = team.perTest[t.key];
          return (
            <div key={t.key} className="grid grid-cols-[88px_minmax(0,1fr)_56px] gap-2 items-center text-sm">
              <span className="text-white">{t.label}</span>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                {s && <div className={`h-2 rounded-full ${s.median >= 0 ? 'bg-amber-500' : 'bg-sky-400'}`} style={{ width: `${(Math.abs(s.median) / maxPct) * 100}%` }} />}
              </div>
              <span className={`text-right font-bold tabular-nums ${s ? (s.median >= 0 ? 'text-white' : 'text-sky-300') : 'text-neutral-600'}`}>{s ? fmtPct(s.median) : '—'}</span>
            </div>
          );
        })}
        <p className="text-[11px] text-neutral-500">
          The typical (median) player's change, first test vs latest, counting players tested at least twice
          {team.overall ? ` (${team.overall.n})` : ''}. Faster times and bigger numbers both count as +.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-center">
          <p className="text-xl font-black text-amber-500">{prs && prs.comparableResults ? `${Math.round((prs.prCount / prs.comparableResults) * 100)}%` : '—'}</p>
          <p className="text-[11px] text-neutral-400">{last ? `of results on ${shortDay(last.date)} were PRs` : 'of results were PRs'}</p>
        </div>
        <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-center">
          <p className="text-xl font-black text-white">{totals.broncoSecondsOff > 0 ? formatBronco(totals.broncoSecondsOff) : '—'}</p>
          <p className="text-[11px] text-neutral-400">off the {squad === 'All' ? "team's" : `${squad}'s`} Bronco total</p>
        </div>
        <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-center">
          <p className="text-xl font-black text-white">{totals.squatLbAdded > 0 ? `+${Math.round(totals.squatLbAdded).toLocaleString()} lb` : '—'}</p>
          <p className="text-[11px] text-neutral-400">added to the {squad === 'All' ? "team's" : `${squad}'s`} squat</p>
        </div>
      </div>

      {isCoach && backwards.length > 0 && (
        <p className="text-xs text-neutral-400 p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
          <span className="text-sky-300 font-bold">Went backwards on 2+ tests</span> (coaches only): {backwards.join(', ')}
        </p>
      )}
    </div>
  );
};

export default TeamProgress;
