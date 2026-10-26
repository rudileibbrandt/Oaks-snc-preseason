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
  GROUPS, LEVELS, PositionGroup, STANDARDS, TESTS, bestThisSeason, formatGap, formatStandard, formatValue,
  groupLabel, levelIndex, nextLevel, playerGroup, scoreOf,
} from '../services/standards';
import TestingDays from './TestingDays';
import LevelChip, { CHIP } from './LevelChip';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

type Tab = 'mine' | 'team' | 'testing' | 'tables';

const StandardsView: React.FC<Props> = ({ onNavigate, currentPlayer }) => {
  const isCoach = currentPlayer?.role === 'Coach';
  const [tab, setTab] = useState<Tab>('tables');
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
  const best = useMemo(() => bestThisSeason(mine, sessions), [mine, sessions]);
  const sessionName = (id: string) => sessions.find(s => s.id === id)?.name ?? 'Testing day';

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
        <div className="space-y-2">
          {TESTS.map(t => {
            const b = best[t.key];
            const idx = b ? levelIndex(group, t.key, b.value) : null;
            const next = b ? nextLevel(group, t.key, b.value) : undefined;
            const row = STANDARDS[group][t.key];
            return (
              <div key={t.key} className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white font-bold text-sm">{t.label}</p>
                  {idx !== null ? <LevelChip idx={idx} /> : <span className="text-xs text-neutral-500">Not tested</span>}
                </div>
                {b && (
                  <p className="text-xs text-neutral-400 mt-1">
                    Best this season <span className="text-white font-bold">{formatValue(t.key, b.value)}</span> · {sessionName(b.sessionId)}
                    {next ? <> · <span className="text-amber-400">{formatGap(t.key, next.gap)} to {next.level}</span></> : <> · <span className="text-amber-400">top level</span></>}
                  </p>
                )}
                <div className="grid grid-cols-4 gap-1 mt-3">
                  {LEVELS.map((lvl, i) => (
                    <div key={lvl} className={`text-center rounded-md py-1.5 ${idx !== null && idx >= i ? CHIP[i] : 'bg-black/40 text-neutral-500'}`}>
                      <div className="text-[10px] uppercase tracking-wide">{lvl}</div>
                      <div className="text-xs font-bold">{formatStandard(t.key, row[i])}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-neutral-500">
            Times: at or under the line. Jump and lifts: at or over. Chin-up total = bodyweight + weight added.
            Your level is your best result since {TESTING_SEASON_START}.
          </p>
        </div>
      )}

      {mine.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-neutral-300">Your testing days</h3>
          {[...mine].sort((a, b) => (sessions.find(s => s.id === b.sessionId)?.date ?? '').localeCompare(sessions.find(s => s.id === a.sessionId)?.date ?? '')).map(r => {
            const s = sessions.find(x => x.id === r.sessionId);
            const done = TESTS.filter(t => scoreOf(r, t.key) !== undefined);
            return (
              <div key={r.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                <p className="text-xs text-white font-bold">{s?.name ?? 'Testing day'} <span className="text-neutral-500 font-normal">· {s?.date}</span></p>
                <p className="text-[11px] text-neutral-400 mt-0.5">{done.map(t => `${t.label} ${formatValue(t.key, scoreOf(r, t.key)!)}`).join(' · ') || 'No scores'}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------- Coaches: everyone's levels ----------

const TeamLevels: React.FC<{ sessions: TestSession[]; results: TestResult[] }> = ({ sessions, results }) => {
  const { isAlumniName, ready: alumniReady } = useAlumniNames();
  const { squadInfo, ready: classesReady } = useRosterClasses();
  const [squad, setSquad] = useState<'All' | 'Varsity' | 'JV'>('Varsity');
  const [testedOnly, setTestedOnly] = useState(true);

  const rows = useMemo(() => {
    const byPlayer = new Map<string, TestResult[]>();
    for (const r of results) byPlayer.set(r.nameKey, [...(byPlayer.get(r.nameKey) ?? []), r]);
    return ROSTER_PLAYERS
      .filter(p => !isAlumniName(p.name))
      .filter(p => squad === 'All' || squadInfo(p).squad === squad)
      .map(p => {
        const mine = byPlayer.get(normalizeName(p.name)) ?? [];
        return { p, group: playerGroup(mine, sessions, p.bestPosition), best: bestThisSeason(mine, sessions) };
      })
      .filter(r => !testedOnly || Object.keys(r.best).length > 0)
      .sort((a, b) => a.p.name.localeCompare(b.p.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, sessions, squad, testedOnly, alumniReady, classesReady]);

  if (!alumniReady || !classesReady) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-neutral-500" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
          {(['Varsity', 'JV', 'All'] as const).map(s => (
            <button key={s} onClick={() => setSquad(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${squad === s ? 'bg-amber-500 text-black' : 'text-neutral-400'}`}>{s}</button>
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
          <table className="w-full text-xs">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="text-left p-2 sticky left-0 bg-neutral-900">Player</th>
                {TESTS.map(t => <th key={t.key} className="p-2 text-center whitespace-nowrap">{t.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, group, best }) => (
                <tr key={p.name} className="border-t border-neutral-800">
                  <td className="p-2 sticky left-0 bg-neutral-950">
                    <div className="text-white whitespace-nowrap">{p.name}</div>
                    <div className="text-[10px] text-neutral-500 whitespace-nowrap">{group ? groupLabel(group).split(' · ')[0] : 'No position'}</div>
                  </td>
                  {TESTS.map(t => {
                    const b = best[t.key];
                    return (
                      <td key={t.key} className="p-2 text-center">
                        {b && group ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-neutral-200">{formatValue(t.key, b.value)}</span>
                            <LevelChip idx={levelIndex(group, t.key, b.value)} small />
                          </div>
                        ) : <span className="text-neutral-700">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-neutral-500">Best result per test since {TESTING_SEASON_START}.</p>
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
