import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Medal, Loader2 } from 'lucide-react';
import { AppView, Player, TestResult, TestSession } from '../types';
import { db } from '../services/db';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { normalizeName } from '../services/alumni';
import { TESTING_SEASON_START } from '../services/season';
import { useAlumniNames } from '../hooks/useAlumniNames';
import { useRosterClasses } from '../hooks/useRosterContext';
import {
  GROUPS, LEVELS, PositionGroup, STANDARDS, TESTS, formatStandard, formatValue,
  groupLabel, levelIndex, playerGroup, testSummary,
} from '../services/standards';
import TestingDays from './TestingDays';
import LevelChip from './LevelChip';
import ResultCards from './ResultCards';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

type Tab = 'mine' | 'team' | 'testing' | 'tables';

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
    const allowed: Tab[] = isCoach ? ['tables', 'team', 'testing'] : ['tables', 'mine'];
    return t && allowed.includes(t) ? t : 'tables';
  });
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([db.getTestSessions(), db.getTestResults()]);
      setSessions(s);
      setResults(r);
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
    ? [['tables', 'Standards'], ['team', 'Team'], ['testing', 'Testing days']]
    : [['tables', 'Standards'], ['mine', 'My levels']];

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
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-colors ${tab === key ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && tab !== 'tables' ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-neutral-500" /></div>
      ) : tab === 'mine' && currentPlayer ? (
        <MyLevels player={currentPlayer} sessions={sessions} results={results} />
      ) : tab === 'team' ? (
        <TeamLevels sessions={sessions} results={results} />
      ) : tab === 'testing' && isCoach && currentPlayer ? (
        <TestingDays currentPlayer={currentPlayer} sessions={sessions} results={results} onChanged={load} />
      ) : (
        <StandardsTables />
      )}
    </div>
  );
};

// ---------- A player's own levels ----------

const MyLevels: React.FC<{ player: Player; sessions: TestSession[]; results: TestResult[] }> = ({ player, sessions, results }) => {
  const key = normalizeName(player.name);
  const rosterPlayer = ROSTER_PLAYERS.find(p => normalizeName(p.name) === key);
  const mine = useMemo(() => results.filter(r => r.nameKey === key), [results, key]);
  const defaultGroup = playerGroup(mine, sessions, rosterPlayer?.bestPosition);
  const [group, setGroup] = useState<PositionGroup | ''>(defaultGroup ?? '');

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs text-neutral-500">Your position group</span>
        <select value={group} onChange={e => setGroup(e.target.value as PositionGroup)}
          className="mt-1 w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white">
          <option value="">Choose your position…</option>
          {GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      </label>

      {mine.length === 0 && (
        <p className="text-sm text-neutral-400 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
          No test results yet. Your coach enters them after each testing day. Until then, the numbers below are the lines to aim for.
        </p>
      )}

      {group && (
        <>
          <ResultCards group={group} results={mine} sessions={sessions} />
          <p className="text-[11px] text-neutral-500">
            Your tier is your best result since {seasonStartLabel}. Times count at or under the line; jump and lifts at or over.
            Chin-up total = bodyweight + weight added.
          </p>
        </>
      )}
    </div>
  );
};

// ---------- Coaches: everyone's levels ----------

type Mode = 'best' | 'latest' | 'worst';
const MODE_NOTE: Record<Mode, string> = {
  best: `Best result per test since ${seasonStartLabel}. The chip is the player's tier.`,
  latest: 'Most recent result per test. The chip shows the tier that result reaches.',
  worst: `Weakest result per test since ${seasonStartLabel}. Missed tests are not counted.`,
};

const TeamLevels: React.FC<{ sessions: TestSession[]; results: TestResult[] }> = ({ sessions, results }) => {
  const { isAlumniName, ready: alumniReady } = useAlumniNames();
  const { squadInfo, ready: classesReady } = useRosterClasses();
  const [squad, setSquad] = useState<'All' | 'Varsity' | 'JV'>('Varsity');
  const [testedOnly, setTestedOnly] = useState(true);
  const [mode, setMode] = useState<Mode>('best');
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    const byPlayer = new Map<string, TestResult[]>();
    for (const r of results) byPlayer.set(r.nameKey, [...(byPlayer.get(r.nameKey) ?? []), r]);
    return ROSTER_PLAYERS
      .filter(p => !isAlumniName(p.name))
      .filter(p => squad === 'All' || squadInfo(p).squad === squad)
      .map(p => {
        const mine = byPlayer.get(normalizeName(p.name)) ?? [];
        const summaries = Object.fromEntries(TESTS.map(t => [t.key, testSummary(mine, sessions, t.key)]));
        return { p, mine, group: playerGroup(mine, sessions, p.bestPosition), summaries };
      })
      .filter(r => !testedOnly || Object.values(r.summaries).some(Boolean))
      .sort((a, b) => a.p.name.localeCompare(b.p.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, sessions, squad, testedOnly, alumniReady, classesReady]);

  // Players at Silver or better per test, for the chosen result.
  const silverPlus = TESTS.map(t => rows.filter(({ group, summaries }) => {
    const s = summaries[t.key];
    return s && group && levelIndex(group, t.key, s[mode].value) >= 1;
  }).length);

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
          {([['best', 'Best'], ['latest', 'Latest'], ['worst', 'Worst']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} className={seg(mode === m)}>{label}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={testedOnly} onChange={e => setTestedOnly(e.target.checked)} /> Tested this season only
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-8">
          {testedOnly ? 'Nobody tested yet this season. Add results under Testing days.' : 'No players in this squad.'}
        </p>
      ) : (
        <div className="overflow-x-auto border border-neutral-800 rounded-xl">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="text-left p-2 sticky left-0 bg-neutral-900">Player</th>
                {TESTS.map(t => <th key={t.key} className="p-2 text-center whitespace-nowrap">{t.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, group, summaries }) => {
                const isSel = p.name === selected;
                return (
                  <tr key={p.name} tabIndex={0}
                    onClick={() => setSelected(isSel ? null : p.name)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(isSel ? null : p.name); } }}
                    className={`border-t border-neutral-800 cursor-pointer ${isSel ? 'bg-amber-500/10' : 'hover:bg-neutral-900'}`}>
                    <td className={`p-2 sticky left-0 ${isSel ? 'bg-[#1c1608]' : 'bg-neutral-950'}`}>
                      <div className="text-white whitespace-nowrap">{p.name}</div>
                      <div className="text-[10px] text-neutral-500 whitespace-nowrap">{group ? groupLabel(group).split(' · ')[0] : 'No position'}</div>
                    </td>
                    {TESTS.map(t => {
                      const s = summaries[t.key];
                      return (
                        <td key={t.key} className="p-2 text-center">
                          {s && group ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-neutral-200">{formatValue(t.key, s[mode].value)}</span>
                              <LevelChip idx={levelIndex(group, t.key, s[mode].value)} small />
                            </div>
                          ) : <span className="text-neutral-700">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="border-t border-neutral-700 bg-neutral-900/60 text-[10px] text-neutral-400">
                <td className="p-2 sticky left-0 bg-neutral-900 whitespace-nowrap">Silver or better</td>
                {silverPlus.map((n, i) => <td key={TESTS[i].key} className="p-2 text-center">{n} of {rows.length}</td>)}
              </tr>
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
        Bronze = a good U16 player · Silver = a good U18 · Gold = a good U20 · Elite = a men's international.
        Times: at or under. Jump and lifts: at or over.
      </p>
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-neutral-300">How we test</h3>
        {TESTS.map(t => (
          <div key={t.key} className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
            <p className="text-xs text-white font-bold">{t.label}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">{t.how}</p>
          </div>
        ))}
        <p className="text-[11px] text-neutral-500">Same surface, same order, warm up first.</p>
      </div>
    </div>
  );
};

export default StandardsView;
