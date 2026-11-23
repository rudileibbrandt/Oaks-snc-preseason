import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Medal, Loader2, Youtube, Pencil, ChevronRight } from 'lucide-react';
import { AppView, Player, TeamGoal, TestResult, TestSession } from '../types';
import { db } from '../services/db';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { normalizeName } from '../services/alumni';
import { DEFAULT_GOAL, TESTING_SEASON_START } from '../services/season';
import { useAlumniNames } from '../hooks/useAlumniNames';
import { useRosterClasses } from '../hooks/useRosterContext';
import { classKey } from '../services/classYears';
import { canSetPositions, effectivePositions, positionList, withBest } from '../services/positions';
import { POSITION_OPTIONS } from '../services/positionData';
import type { RugbyPosition } from '../types';
import {
  GROUPS, LEVELS, PositionGroup, STANDARDS, TESTS, formatStandard, formatValue,
  groupLabel, levelIndex, playerGroup, testSummary,
} from '../services/standards';
import TestingDays, { EntryModal } from './TestingDays';
import LevelChip from './LevelChip';
import BoardHighlight, { Highlight, SHORT, loadHighlight, saveHighlight } from './BoardHighlight';
import ResultCards from './ResultCards';
import TeamProgress from './TeamProgress';
import MyProgress, { NextTestingBanner } from './MyProgress';
import { playerImprovement } from '../services/improvement';
import { LOWER, fmtPct, seriesOf, shortDay } from '../services/teamProgress';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

// Players: Me, Team, Standards. Coaches: Team, Testing, Board, Standards (Rudi, 22 Nov 2026).
type Tab = 'mine' | 'team' | 'testing' | 'board' | 'tables';

// Another screen (the Calendar) can ask Standards to open on a given tab next time it mounts.
let startTab: Tab | null = null;
export const openStandardsOn = (tab: Tab) => { startTab = tab; };

const seasonStartLabel = new Date(TESTING_SEASON_START + 'T12:00:00')
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const StandardsView: React.FC<Props> = ({ onNavigate, currentPlayer }) => {
  const isCoach = currentPlayer?.role === 'Coach';
  const [tab, setTab] = useState<Tab>(() => {
    const t = startTab;
    startTab = null;
    const allowed: Tab[] = isCoach ? ['team', 'testing', 'board', 'tables'] : ['mine', 'team', 'tables'];
    return t && allowed.includes(t) ? t : isCoach ? 'team' : currentPlayer ? 'mine' : 'tables';
  });
  const [openTestingId, setOpenTestingId] = useState<string | undefined>(undefined);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [goal, setGoal] = useState<TeamGoal>(DEFAULT_GOAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, r, g] = await Promise.all([
        db.getTestSessions(), db.getTestResults(),
        // No goal saved yet (or it can't be read): the default goal.
        db.getTeamGoal().catch(e => { console.warn('[StandardsView] Could not load goal:', e); return null; }),
      ]);
      setSessions(s);
      setResults(r);
      setGoal(g ?? DEFAULT_GOAL);
      setError(null);
    } catch (e) {
      console.error('[StandardsView] Could not load testing data:', e);
      setError('Could not load test results. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const tabs: [Tab, string][] = isCoach
    ? [['team', 'Team'], ['testing', 'Testing'], ['board', 'Board'], ['tables', 'Standards']]
    : [['mine', 'Me'], ['team', 'Team'], ['tables', 'Standards']];

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('LANDING')} className="p-2 -ml-2 text-neutral-400 hover:text-white"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Medal size={22} className="text-amber-400" />S&C Standards</h1>
          <p className="text-xs text-neutral-500">Bronze · Silver · Gold · Elite, by position</p>
        </div>
      </div>

      <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setOpenTestingId(undefined); }}
            className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-colors ${tab === key ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && tab !== 'tables' ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-neutral-500" /></div>
      ) : tab === 'mine' && currentPlayer ? (
        <div className="space-y-3">
          <NextTestingBanner sessions={sessions} />
          <MyLevels player={currentPlayer} sessions={sessions} results={results} goal={goal} onChanged={load} />
        </div>
      ) : tab === 'team' ? (
        <div className="space-y-3">
          <NextTestingBanner sessions={sessions} isCoach={isCoach}
            onStart={id => { setOpenTestingId(id); setTab('testing'); }} />
          <TeamProgress sessions={sessions} results={results} isCoach={isCoach} goal={goal} onGoalSaved={load} coachName={currentPlayer?.name} />
        </div>
      ) : tab === 'board' && isCoach ? (
        <TeamLevels sessions={sessions} results={results} />
      ) : tab === 'testing' && isCoach && currentPlayer ? (
        <TestingDays key={openTestingId ?? 'list'} currentPlayer={currentPlayer} sessions={sessions} results={results} onChanged={load} initialOpenId={openTestingId} />
      ) : (
        <StandardsTables />
      )}
    </div>
  );
};

// ---------- A player's own levels ----------

// Local calendar date, YYYY-MM-DD (testing days are stored that way).
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MyLevels: React.FC<{ player: Player; sessions: TestSession[]; results: TestResult[]; goal: TeamGoal; onChanged: () => Promise<void> }> = ({ player, sessions, results, goal, onChanged }) => {
  const key = normalizeName(player.name);
  const rosterPlayer = ROSTER_PLAYERS.find(p => normalizeName(p.name) === key);
  const mine = useMemo(() => results.filter(r => r.nameKey === key), [results, key]);
  // Positions are shared: the player sets their own here, unless a coach has set them.
  const { classes, reload: reloadClasses, ready: positionsReady } = useRosterClasses();
  const positions = effectivePositions(rosterPlayer ?? {}, classes[classKey(rosterPlayer?.name ?? player.name)]);
  const group = playerGroup(mine, sessions, positions.best);
  const [savingPosition, setSavingPosition] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const handlePosition = async (best: RugbyPosition) => {
    const name = rosterPlayer?.name ?? player.name;
    setSavingPosition(true);
    setPositionError(null);
    try {
      await db.setRosterClass(classKey(name), name, { positions: withBest(best, positionList(positions)), positionsBy: player.role === 'Coach' ? 'coach' : 'player' });
      reloadClasses();
    } catch (e) {
      console.error('[StandardsView] Could not save position:', e);
      setPositionError('Could not save your position. Try again.');
    } finally {
      setSavingPosition(false);
    }
  };
  const [entering, setEntering] = useState<TestSession | null>(null);

  // Players enter their own scores for testing days that have started (most recent first).
  // A score a coach entered is the player's to see, not to change.
  const enterable = useMemo(() => {
    const today = localToday();
    return sessions.filter(s => s.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions]);
  const resultFor = (sessionId: string) => mine.find(r => r.sessionId === sessionId);
  const coachEntered = (r?: TestResult) => !!r && normalizeName(r.enteredBy) !== key;

  const positionBlock = (
      <label className="block">
        <span className="text-xs text-neutral-500">Your main position</span>
        {canSetPositions('player', positions.source === 'coach' ? 'coach' : 'player') ? (
          <select value={positions.best ?? ''} disabled={savingPosition || !positionsReady}
            onChange={e => e.target.value && handlePosition(Number(e.target.value) as RugbyPosition)}
            className="mt-1 w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white disabled:opacity-50">
            <option value="">Not set: tested as back row</option>
            {POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.short} · {o.label}</option>)}
          </select>
        ) : (
          <p className="mt-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white">
            {POSITION_OPTIONS.find(o => o.value === positions.best)?.short ?? 'None'} <span className="text-xs text-neutral-500">· set by your coach</span>
          </p>
        )}
        <span className="mt-1 block text-[11px] text-neutral-500">Tested as {groupLabel(group).split(' · ')[0]}</span>
        {positionError && <span className="mt-1 block text-xs text-red-400">{positionError}</span>}
      </label>
  );

  // The latest testing day, one tap from the top (Rudi, 22 Nov 2026). Hidden once a coach has
  // entered it; older days stay in the list at the bottom.
  const latest = enterable[0];
  const latestResult = latest ? resultFor(latest.id) : undefined;
  const latestCard = latest && !coachEntered(latestResult) && (
    <button onClick={() => setEntering(latest)}
      className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${latestResult
        ? 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800'
        : 'bg-amber-500/10 border-amber-600/60 hover:bg-amber-500/15'}`}>
      <div className={`p-2 rounded-lg flex-shrink-0 ${latestResult ? 'bg-neutral-800 text-neutral-300' : 'bg-amber-500 text-black'}`}><Pencil size={18} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{latestResult ? 'Your testing results are in' : 'Add your testing results'}</p>
        <p className="text-xs text-neutral-400 truncate">{latest.name} · {shortDay(latest.date)} · {latestResult ? 'tap to check or change' : 'tap to enter'}</p>
      </div>
      <ChevronRight size={18} className={latestResult ? 'text-neutral-500' : 'text-amber-400'} />
    </button>
  );

  return (
    <div className="space-y-4">
      {latestCard}
      <MyProgress group={group} results={mine} sessions={sessions} goal={goal} />

      <h3 className="text-sm font-bold text-neutral-300 pt-2">All your results</h3>
      {mine.length === 0 && (
        <p className="text-sm text-neutral-400 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
          No test results yet. Capture your scores here after each testing day. Until then, the numbers below are the lines to aim for.
        </p>
      )}
      <ResultCards group={group} results={mine} sessions={sessions} />
      <p className="text-[11px] text-neutral-500">
        Your tier is your best result since {seasonStartLabel}. Times count at or under the line; jump and lifts at or over.
        Chin-up total = bodyweight + weight added. Chin-up reps are graded on the total those reps estimate at your bodyweight.
      </p>

      {positionBlock}

      {enterable.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500">Your scores, every testing day: enter or check them</p>
          {enterable.map(s => {
            const r = resultFor(s.id);
            const locked = coachEntered(r);
            return (
              <button key={s.id} disabled={locked} onClick={() => setEntering(s)}
                className="w-full flex items-center justify-between gap-3 p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-left disabled:hover:bg-neutral-900">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{s.name}</p>
                  <p className="text-[11px] text-neutral-500">
                    {s.date} · {!r ? 'Not entered' : locked ? `Entered by ${r.enteredBy}` : 'Entered by you, tap to change'}
                  </p>
                </div>
                {!locked && <Pencil size={14} className="text-amber-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {entering && (
        <EntryModal
          session={entering}
          playerName={rosterPlayer?.name ?? player.name}
          existing={resultFor(entering.id)}
          defaultGroup={group}
          currentPlayer={player}
          onClose={() => setEntering(null)}
          onSaved={async () => { await onChanged(); setEntering(null); }}
        />
      )}

    </div>
  );
};

// ---------- Coaches: everyone's levels ----------

type Mode = 'best' | 'latest' | 'worst' | 'change';
const MODE_NOTE: Record<Mode, string> = {
  best: `Best result per test since ${seasonStartLabel}. The chip is the player's tier.`,
  latest: 'Most recent result per test. The chip shows the tier that result reaches.',
  worst: `Weakest result per test since ${seasonStartLabel}. Missed tests are not counted.`,
  change: 'Latest result vs first test this season, as a %: faster or more is +, blue is backwards. Overall = the average of tests done twice. Bottom row = the median player.',
};

const TeamLevels: React.FC<{ sessions: TestSession[]; results: TestResult[] }> = ({ sessions, results }) => {
  const { isAlumniName, ready: alumniReady } = useAlumniNames();
  const { squadInfo, positionsOf, classes, ready: classesReady } = useRosterClasses();
  const [squad, setSquad] = useState<'All' | 'Varsity' | 'JV'>('Varsity');
  const [testedOnly, setTestedOnly] = useState(true);
  const [mode, setMode] = useState<Mode>('best');
  const [selected, setSelected] = useState<string | null>(null);
  const [hl, setHl] = useState<Highlight>(loadHighlight);
  const changeHl = (h: Highlight) => { setHl(h); saveHighlight(h); };
  // On a phone the picked test's column can be off to the right: bring it into view, past the sticky names.
  const tableBox = useRef<HTMLDivElement>(null);

  const squadRows = useMemo(() => {
    const byPlayer = new Map<string, TestResult[]>();
    for (const r of results) byPlayer.set(r.nameKey, [...(byPlayer.get(r.nameKey) ?? []), r]);
    return ROSTER_PLAYERS
      .filter(p => !isAlumniName(p.name))
      .filter(p => squad === 'All' || squadInfo(p).squad === squad)
      .map(p => {
        const mine = byPlayer.get(normalizeName(p.name)) ?? [];
        const summaries = Object.fromEntries(TESTS.map(t => [t.key, testSummary(mine, sessions, t.key)]));
        return { p, mine, group: playerGroup(mine, sessions, positionsOf(p).best), summaries, imp: playerImprovement(seriesOf(mine, sessions), LOWER) };
      })
      .sort((a, b) => a.p.name.localeCompare(b.p.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, sessions, squad, alumniReady, classesReady, classes]);
  // "Not tested" looks at the whole squad, so players with no tests at all are included.
  const notTestedMode = !!hl.test && hl.show === 'untested';
  const allRows = testedOnly && !notTestedMode ? squadRows.filter(r => Object.values(r.summaries).some(Boolean)) : squadRows;

  // Highlight (Rudi, 22 Nov 2026): the players short of the chosen tier line on the chosen test.
  // Untested players aren't flagged as short; the "Not tested" option flags them instead.
  // The Change view has no tier per cell, so it judges on best results.
  const scoreMode = mode === 'change' ? 'best' : mode;
  const isShort = (r: typeof allRows[number]) => {
    const s = hl.test ? r.summaries[hl.test] : undefined;
    return !!hl.test && !!s && !!r.group && levelIndex(r.group, hl.test, s[scoreMode].value) < hl.level;
  };
  const isUntested = (r: typeof allRows[number]) => !!hl.test && !r.summaries[hl.test];
  const flagged = new Set(allRows.filter(notTestedMode ? isUntested : isShort).map(r => r.p.name));
  const untested = hl.test ? squadRows.filter(isUntested).length : 0;
  const short = hl.test ? squadRows.filter(isShort).length : 0;
  const rows = hl.test && hl.onlyFlagged ? allRows.filter(r => flagged.has(r.p.name)) : allRows;
  const tableShown = alumniReady && classesReady && rows.length > 0;
  useEffect(() => {
    // A short wait: the Tailwind CDN styles new markup a moment after React renders it.
    const id = setTimeout(() => {
      const box = tableBox.current, th = box?.querySelector<HTMLElement>(`th[data-test="${hl.test}"]`);
      const names = box?.querySelector<HTMLElement>('th');
      if (box && th && names) box.scrollTo({ left: Math.max(0, th.offsetLeft - names.offsetWidth - 8), behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(id);
  }, [hl.test, mode, tableShown]);

  // Players at Silver or better per test, out of those who did that test (no score isn't counted against).
  const silverPlus = mode === 'change' ? [] : TESTS.map(t => {
    const did = allRows.filter(({ group, summaries }) => summaries[t.key] && group);
    return { n: did.filter(({ group, summaries }) => levelIndex(group!, t.key, summaries[t.key]![mode].value) >= 1).length, of: did.length };
  });
  const medianOf = (xs: (number | undefined)[]) => {
    const a = xs.filter((x): x is number => x !== undefined).sort((x, y) => x - y);
    return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : undefined;
  };
  const pctCell = (v: number | undefined, bold?: boolean) => v === undefined
    ? <span className="text-neutral-700">—</span>
    : <span className={`${bold ? 'font-bold ' : ''}${v > 0 ? 'text-amber-500' : v < 0 ? 'text-sky-300' : 'text-neutral-300'}`}>{fmtPct(v)}</span>;

  const picked = rows.find(r => r.p.name === selected);

  if (!alumniReady || !classesReady) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-neutral-500" /></div>;

  const seg = (on: boolean) => `px-3 py-1 text-xs font-medium rounded-md ${on ? 'bg-amber-500 text-black' : 'text-neutral-400'}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
          {(['Varsity', 'JV', 'All'] as const).map(s => (
            <button key={s} onClick={() => setSquad(s)} className={seg(squad === s)}>{s}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800" role="group" aria-label="Show result">
          {([['best', 'Best'], ['latest', 'Latest'], ['worst', 'Worst'], ['change', 'Change']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} className={seg(mode === m)}>{label}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={testedOnly} onChange={e => setTestedOnly(e.target.checked)} /> Tested this season only
        </label>
      </div>
      <BoardHighlight value={hl} onChange={changeHl} short={short} untested={untested} changeMode={mode === 'change'} />
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-8">
          {allRows.length > 0 && hl.test ? (notTestedMode ? `Everyone has done ${SHORT[hl.test]}.` : `Nobody is below ${LEVELS[hl.level]} on ${SHORT[hl.test]}.`)
            : testedOnly ? 'Nobody tested yet this season. Add results under Testing days.' : 'No players in this squad.'}
        </p>
      ) : (
        <div ref={tableBox} className="overflow-x-auto border border-neutral-800 rounded-xl">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="text-left p-2 sticky left-0 bg-neutral-900">Player</th>
                {TESTS.map(t => <th key={t.key} data-test={t.key} className={`p-2 text-center whitespace-nowrap ${hl.test === t.key ? 'text-red-300 bg-red-500/10' : ''}`}>{t.label}</th>)}
                {mode === 'change' && <th className="p-2 text-center whitespace-nowrap">Overall</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, group, summaries, imp }) => {
                const isSel = p.name === selected;
                const hot = flagged.has(p.name);
                const tint = notTestedMode
                  ? { row: 'bg-sky-500/[0.07] hover:bg-sky-500/10', name: 'bg-[#0c1519] shadow-[inset_3px_0_0_#38bdf8]' }
                  : { row: 'bg-red-500/[0.07] hover:bg-red-500/10', name: 'bg-[#1a0d0d] shadow-[inset_3px_0_0_#ef4444]' };
                return (
                  <tr key={p.name} tabIndex={0}
                    onClick={() => setSelected(isSel ? null : p.name)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(isSel ? null : p.name); } }}
                    className={`border-t border-neutral-800 cursor-pointer ${isSel ? 'bg-amber-500/10' : hot ? tint.row : 'hover:bg-neutral-900'}`}>
                    <td className={`p-2 sticky left-0 ${isSel ? 'bg-[#1c1608]' : hot ? tint.name : 'bg-neutral-950'}`}>
                      <div className="whitespace-nowrap text-white">
                        {p.name}
                        {hot && <span className="sr-only"> ({notTestedMode ? 'not tested' : `below ${LEVELS[hl.level]}`} on {SHORT[hl.test!]})</span>}
                      </div>
                      <div className="text-[10px] text-neutral-500 whitespace-nowrap">{group ? groupLabel(group).split(' · ')[0] : 'No position'}</div>
                    </td>
                    {TESTS.map(t => {
                      const s = summaries[t.key];
                      if (hot && notTestedMode && hl.test === t.key) return (
                        <td key={t.key} className="p-1.5 text-center">
                          <div className="rounded-lg border border-dashed border-sky-500/50 bg-sky-500/10 px-1 py-1.5 text-[10px] font-bold text-sky-300 whitespace-nowrap">Not tested</div>
                        </td>
                      );
                      if (mode === 'change') return <td key={t.key} className="p-2 text-center">{pctCell(imp.perTest[t.key])}</td>;
                      return (
                        <td key={t.key} className="p-1.5 text-center">
                          {s && group ? (hot && hl.test === t.key ? (
                            <div className="flex flex-col items-center gap-0.5 rounded-lg bg-red-500/10 ring-1 ring-inset ring-red-500/40 px-1 py-1">
                              <span className="text-red-300 font-bold">{formatValue(t.key, s[mode])}</span>
                              <LevelChip idx={levelIndex(group, t.key, s[mode].value)} small />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-neutral-200">{formatValue(t.key, s[mode])}</span>
                              <LevelChip idx={levelIndex(group, t.key, s[mode].value)} small />
                            </div>
                          )) : <span className="text-neutral-700">—</span>}
                        </td>
                      );
                    })}
                    {mode === 'change' && <td className="p-2 text-center">{pctCell(imp.overall, true)}</td>}
                  </tr>
                );
              })}
              {mode === 'change' ? (
                <tr className="border-t border-neutral-700 bg-neutral-900/60 text-[11px]">
                  <td className="p-2 sticky left-0 bg-neutral-900 whitespace-nowrap text-neutral-400">Team (median)</td>
                  {TESTS.map(t => <td key={t.key} className="p-2 text-center">{pctCell(medianOf(allRows.map(r => r.imp.perTest[t.key])))}</td>)}
                  <td className="p-2 text-center">{pctCell(medianOf(allRows.map(r => r.imp.overall)), true)}</td>
                </tr>
              ) : (
              <tr className="border-t border-neutral-700 bg-neutral-900/60 text-[10px] text-neutral-400">
                <td className="p-2 sticky left-0 bg-neutral-900 whitespace-nowrap">Silver or better</td>
                {silverPlus.map((x, i) => <td key={TESTS[i].key} className="p-2 text-center">{x.of ? `${x.n} of ${x.of}` : '—'}</td>)}
              </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-neutral-500">{MODE_NOTE[mode]} Tap a player to see their results.</p>

      {picked && (
        <div className="space-y-2 pt-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h3 className="text-base font-bold text-white">{picked.p.name}</h3>
            <span className="text-[11px] text-neutral-500">
              {picked.group ? groupLabel(picked.group).split(' · ')[0] : 'No position'} · what they see under My levels
            </span>
          </div>
          {picked.group
            ? <ResultCards key={picked.p.name} group={picked.group} results={picked.mine} sessions={sessions} wide />
            : <p className="text-sm text-neutral-500">No position set, so there are no tier lines to compare against.</p>}
        </div>
      )}
    </div>
  );
};

// ---------- The standards tables ----------

const StandardsTables: React.FC = () => {
  const [group, setGroup] = useState<PositionGroup>('props');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {GROUPS.map(g => (
          <button key={g.key} onClick={() => setGroup(g.key)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg ${group === g.key ? 'bg-amber-500 text-black' : 'bg-neutral-900 border border-neutral-800 text-neutral-400'}`}>
            {g.label.split(' · ')[0]}
          </button>
        ))}
      </div>
      <h2 className="text-lg font-bold text-white">{groupLabel(group)}</h2>
      <div className="overflow-x-auto border border-neutral-800 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900">
            <tr>
              <th className="text-left p-2 text-neutral-400">Test</th>
              {LEVELS.map((l, i) => <th key={l} className="p-2 text-center"><LevelChip idx={i} small /></th>)}
            </tr>
          </thead>
          <tbody>
            {TESTS.map(t => (
              <tr key={t.key} className="border-t border-neutral-800">
                <td className="p-2 text-neutral-200 whitespace-nowrap">{t.label}{t.unit ? ` (${t.unit})` : ''}</td>
                {STANDARDS[group][t.key].map((v, i) => <td key={i} className="p-2 text-center text-white">{formatStandard(t.key, v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-500">
        Bronze = a good U16 player · Silver = a good U18 · Gold = a good U20 · Elite = the top band of USA Rugby's men's standards.
        Times: at or under. Jump and lifts: at or over.
      </p>
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-neutral-300">How we test</h3>
        {TESTS.map(t => (
          <div key={t.key} className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
            <p className="text-xs text-white font-bold">{t.label}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">{t.how}</p>
            {t.videoUrl && (
              <a href={t.videoUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-amber-500 hover:text-amber-400">
                <Youtube size={14} /> Watch the demo
              </a>
            )}
          </div>
        ))}
        <p className="text-[11px] text-neutral-500">Same surface, same order, warm up first.</p>
      </div>
    </div>
  );
};

export default StandardsView;
