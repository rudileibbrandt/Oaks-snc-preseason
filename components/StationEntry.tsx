import React, { useMemo, useState } from 'react';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { Player, TestResult, TestSession } from '../types';
import { db } from '../services/db';
import { normalizeName } from '../services/alumni';
import { formatBroncoTyping, numbersOnly } from '../services/parseScores';
import {
  PositionGroup, StandardTest, TESTS, formatValue, levelIndex, parseBronco, parsePositive, scoreOf,
} from '../services/standards';
import LevelChip from './LevelChip';
import { useBodyStats } from '../hooks/useBodyStats';
import { ROSTER_PLAYERS } from '../services/rosterData';

// Sideline entry on a testing day (Rudi, 22 Nov 2026: testing is live, with coaches, on Sunday).
// Each coach picks their station and works down the roster for that one test. Each box saves on
// its own when you leave it, and only that test is written, so two coaches at different stations
// can enter the same player at once without overwriting each other.

type FieldKey = 'bronco' | 'sprint10' | 'sprint40' | 'broadJump' | 'bodyweight' | 'chinupAdded' | 'squat3rm';
interface Station { key: string; label: string; fields: { key: FieldKey; label: string; hint: string }[]; tests: StandardTest[] }

export const STATIONS: Station[] = [
  { key: 'bronco', label: 'Bronco', fields: [{ key: 'bronco', label: 'Bronco', hint: 'm:ss' }], tests: ['bronco'] },
  { key: 'sprint', label: '10 / 40 m', fields: [{ key: 'sprint10', label: '10 m', hint: '1.82' }, { key: 'sprint40', label: '40 m', hint: '5.61' }], tests: ['sprint10', 'sprint40'] },
  { key: 'broadJump', label: 'Broad jump', fields: [{ key: 'broadJump', label: 'Inches', hint: '94' }], tests: ['broadJump'] },
  { key: 'chinup', label: 'Chin-up', fields: [{ key: 'bodyweight', label: 'Body lb', hint: '170' }, { key: 'chinupAdded', label: 'Added lb', hint: '0' }], tests: ['chinup'] },
  { key: 'squat3rm', label: 'Squat', fields: [{ key: 'squat3rm', label: 'Lb', hint: '245' }], tests: ['squat3rm'] },
];

const toText = (key: FieldKey, v: number | null | undefined) =>
  v == null ? '' : key === 'bronco' ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : String(v);

// '' → null (clear); bad → 'bad'.
const parse = (key: FieldKey, text: string): number | null | 'bad' => {
  if (text.trim() === '') return null;
  if (key === 'chinupAdded' && text.trim() === '0') return 0;
  const v = key === 'bronco' ? parseBronco(text) : parsePositive(text);
  return v === undefined ? 'bad' : v;
};

interface Props {
  session: TestSession;
  players: { name: string; group: PositionGroup }[];
  results: TestResult[];     // this session's results
  allResults: TestResult[];  // every session's, for last result and PRs
  sessions: TestSession[];
  currentPlayer: Player;
  onChanged: () => Promise<void>;
}

const StationEntry: React.FC<Props> = ({ session, players, results, allResults, sessions, currentPlayer, onChanged }) => {
  const [stationKey, setStationKey] = useState(STATIONS[0].key);
  const [show, setShow] = useState<'todo' | 'done' | 'all'>('todo');
  const station = STATIONS.find(s => s.key === stationKey)!;
  const byName = useMemo(() => new Map(results.map(r => [r.nameKey, r])), [results]);
  const isDone = (r?: TestResult) => !!r && station.fields.every(f => r[f.key] != null);
  const doneCount = players.filter(p => isDone(byName.get(normalizeName(p.name)))).length;
  // Freeze the list order while entering, so a row doesn't jump away the moment it's saved.
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const listed = useMemo(() => {
    const keep = players.filter(p => {
      const done = isDone(byName.get(normalizeName(p.name)));
      return show === 'all' || (show === 'done' ? done : !done) || frozen?.includes(p.name);
    });
    return keep;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, byName, show, stationKey, frozen]);

  const dateOf = useMemo(() => new Map(sessions.map(s => [s.id, s.date])), [sessions]);
  const earlier = (name: string) => allResults
    .filter(r => r.nameKey === normalizeName(name) && (dateOf.get(r.sessionId) ?? '') < session.date)
    .sort((a, b) => (dateOf.get(a.sessionId) ?? '').localeCompare(dateOf.get(b.sessionId) ?? ''));

  // Rudi, 22 Nov 2026: don't ask for a bodyweight the app already has. The chin-up station starts
  // with the player's current weight (their own or a coach's entry, an earlier weigh-in, or the
  // team list) and saves it with the chin-up; the coach only types over it if it has changed.
  const { statsFor, ready: weightsReady } = useBodyStats();
  const knownWeight = (name: string) =>
    statsFor(name, ROSTER_PLAYERS.find(r => normalizeName(r.name) === normalizeName(name))).weightLb;

  const pick = (key: string) => { setStationKey(key); setFrozen(null); };
  const pickShow = (s: typeof show) => { setShow(s); setFrozen(null); };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold tracking-wider text-neutral-400">YOUR STATION</p>
        <div className="flex flex-wrap gap-1.5">
          {STATIONS.map(s => (
            <button key={s.key} onClick={() => pick(s.key)}
              className={`min-h-[40px] px-3 rounded-lg text-xs font-bold ${s.key === stationKey ? 'bg-amber-500 text-black' : 'bg-neutral-900 border border-neutral-800 text-neutral-300'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-sm"><span className="text-white font-bold">{doneCount} of {players.length} entered</span><span className="text-neutral-500 text-xs">Saves when you leave a box</span></div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden"><div className="h-2 bg-amber-500" style={{ width: `${players.length ? (doneCount / players.length) * 100 : 0}%` }} /></div>
      </div>
      <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
        {([['todo', `Still to go (${players.length - doneCount})`], ['done', `Entered (${doneCount})`], ['all', 'All']] as const).map(([k, label]) => (
          <button key={k} onClick={() => pickShow(k)} className={`flex-1 min-h-[36px] text-xs font-medium rounded-md ${show === k ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}>{label}</button>
        ))}
      </div>
      <div className="space-y-1.5">
        {listed.map(p => (
          <StationRow key={`${stationKey}-${p.name}-${weightsReady}`} station={station} knownWeight={knownWeight(p.name)} session={session} name={p.name} group={p.group}
            existing={byName.get(normalizeName(p.name))} earlier={earlier(p.name)} currentPlayer={currentPlayer}
            onSaving={() => setFrozen(f => (f ? (f.includes(p.name) ? f : [...f, p.name]) : [p.name]))} onChanged={onChanged} />
        ))}
        {listed.length === 0 && <p className="text-sm text-neutral-500 text-center py-6">{show === 'todo' ? 'Everyone has this station entered.' : 'Nothing here yet.'}</p>}
      </div>
    </div>
  );
};

const StationRow: React.FC<{
  station: Station; session: TestSession; name: string; group: PositionGroup; existing?: TestResult; earlier: TestResult[];
  currentPlayer: Player; onSaving: () => void; onChanged: () => Promise<void>; knownWeight?: number;
}> = ({ station, session, name, group, existing, earlier, currentPlayer, onSaving, onChanged, knownWeight }) => {
  // Bodyweight starts filled in from what the app knows; it's only saved along with a chin-up.
  const prefillWeight = existing?.bodyweight == null && knownWeight != null && station.fields.some(f => f.key === 'bodyweight');
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(station.fields.map(f => [f.key,
      f.key === 'bodyweight' && prefillWeight ? String(knownWeight) : toText(f.key, existing?.[f.key])])));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const parsed = Object.fromEntries(station.fields.map(f => [f.key, parse(f.key, text[f.key])])) as Record<FieldKey, number | null | 'bad'>;
  const bad = station.fields.some(f => parsed[f.key] === 'bad');

  // What's typed, as a result, for the tier and PR preview.
  const typed = { ...existing, ...Object.fromEntries(station.fields.map(f => [f.key, parsed[f.key] === 'bad' ? null : parsed[f.key]])) } as TestResult;
  const previews = station.tests.map(t => {
    const v = scoreOf(typed, t);
    if (v === undefined) return null;
    const lower = TESTS.find(x => x.key === t)!.lowerIsBetter;
    const prev = earlier.map(r => scoreOf(r, t)).filter((x): x is number => x !== undefined);
    const pr = prev.length > 0 && prev.every(x => (lower ? v < x : v > x));
    return { t, v, idx: levelIndex(group, t, v), pr };
  }).filter(Boolean) as { t: StandardTest; v: number; idx: number; pr: boolean }[];
  const lastText = station.tests.map(t => {
    const prev = [...earlier].reverse().find(r => scoreOf(r, t) !== undefined);
    return prev ? formatValue(t, scoreOf(prev, t)!) : null;
  }).filter(Boolean).join(' · ');

  const save = async () => {
    if (bad) return;
    const changed = station.fields.filter(f => (parsed[f.key] ?? null) !== (existing?.[f.key] ?? null))
      // A filled-in bodyweight on its own isn't an entry: wait for the chin-up.
      .filter(f => !(f.key === 'bodyweight' && prefillWeight && parsed.chinupAdded == null && parsed.bodyweight === knownWeight));
    if (changed.length === 0) return;
    onSaving();
    setState('saving');
    try {
      await db.mergeTestResult({
        id: `${session.id}__${normalizeName(name)}`,
        sessionId: session.id,
        nameKey: normalizeName(name),
        playerName: name,
        group: existing?.group ?? group,
        ...Object.fromEntries(changed.map(f => [f.key, parsed[f.key]])),
        enteredBy: currentPlayer.name,
        updatedAt: Date.now(),
      });
      setState('saved');
      await onChanged();
    } catch (e) {
      console.error('[StationEntry] Could not save:', e);
      setState('error');
    }
  };

  const hot = previews.length > 0;
  return (
    <div className={`p-3 rounded-xl border flex items-center gap-3 ${hot ? 'bg-amber-500/10 border-amber-700' : 'bg-neutral-900 border-neutral-800'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-semibold truncate">{name}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px]">
          {previews.map(p => (
            <span key={p.t} className="flex items-center gap-1">
              <LevelChip idx={p.idx} small />
              {p.pr && <span className="px-1 rounded bg-amber-500 text-black font-black">PR</span>}
            </span>
          ))}
          {!hot && <span className="text-neutral-500">{lastText ? `Last: ${lastText}` : 'First test'}</span>}
          {state === 'saving' && <Loader2 size={12} className="animate-spin text-neutral-400" />}
          {state === 'saved' && <Check size={12} className="text-green-400" aria-label="Saved" />}
          {state === 'error' && <span className="flex items-center gap-1 text-red-400"><AlertTriangle size={12} /> Not saved, tap the box and try again</span>}
        </div>
      </div>
      {station.fields.map(f => (
        <label key={f.key} className="flex flex-col items-center gap-0.5">
          {station.fields.length > 1 && <span className="text-[10px] text-neutral-500">{f.key === 'bodyweight' && prefillWeight && parsed.bodyweight === knownWeight ? 'Body lb (known)' : f.label}</span>}
          <input value={text[f.key]} placeholder={f.hint} aria-label={`${name} ${f.label}`}
            inputMode={f.key === 'bronco' ? 'numeric' : 'decimal'}
            enterKeyHint="next"
            onChange={e => { setState('idle'); setText(t => ({ ...t, [f.key]: f.key === 'bronco' ? formatBroncoTyping(e.target.value) : numbersOnly(e.target.value) })); }}
            onBlur={save}
            data-station-input=""
            onKeyDown={e => {
              if (e.key !== 'Enter') return;
              // Enter (Next on a phone) saves and jumps to the next box down the list.
              const all = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-station-input]'));
              const next = all[all.indexOf(e.currentTarget) + 1];
              if (next) next.focus(); else e.currentTarget.blur();
            }}
            className={`w-20 min-h-[44px] px-2 bg-black border rounded-lg text-center text-base font-bold text-white placeholder-neutral-600 ${parsed[f.key] === 'bad' ? 'border-red-500' : 'border-neutral-700 focus:border-amber-500'} outline-none`} />
        </label>
      ))}
    </div>
  );
};

export default StationEntry;
