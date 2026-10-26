import React, { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, X, ClipboardPaste, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Player, TestResult, TestSession } from '../types';
import { db } from '../services/db';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { normalizeName } from '../services/alumni';
import { loadPositionOverrides } from '../services/positionData';
import { useAlumniNames } from '../hooks/useAlumniNames';
import { useRosterClasses } from '../hooks/useRosterContext';
import {
  GROUPS, PositionGroup, TESTS, formatValue, groupForPosition, groupLabel,
  levelIndex, parseBronco, parsePositive, scoreOf,
} from '../services/standards';
import LevelChip from './LevelChip';
import { formatClock } from '../services/calendar';

interface Props {
  currentPlayer: Player;
  sessions: TestSession[];
  results: TestResult[];
  onChanged: () => Promise<void>; // reload sessions and results
}

const today = () => new Date().toISOString().split('T')[0];
const resultId = (sessionId: string, name: string) => `${sessionId}__${normalizeName(name)}`;

// The fields a coach types in, as text (Bronco as m:ss).
type Form = { group: PositionGroup | ''; bodyweight: string; bronco: string; sprint10: string; sprint40: string; broadJump: string; chinupAdded: string; squat3rm: string };
const FIELDS: { key: Exclude<keyof Form, 'group'>; label: string; hint: string }[] = [
  { key: 'bodyweight', label: 'Bodyweight (lb)', hint: 'for chin-up total' },
  { key: 'bronco', label: 'Bronco (m:ss)', hint: 'e.g. 5:24' },
  { key: 'sprint10', label: '10 m (s)', hint: 'e.g. 1.82' },
  { key: 'sprint40', label: '40 m (s)', hint: 'e.g. 5.61' },
  { key: 'broadJump', label: 'Broad jump (in)', hint: 'e.g. 94' },
  { key: 'chinupAdded', label: 'Chin-up added (lb)', hint: '0 = bodyweight only' },
  { key: 'squat3rm', label: 'Squat 3RM (lb)', hint: 'e.g. 245' },
];

// "" → null (not tested); bad text → 'bad'.
const parseField = (key: Exclude<keyof Form, 'group'>, text: string): number | null | 'bad' => {
  if (text.trim() === '') return null;
  if (key === 'chinupAdded' && text.trim() === '0') return 0;
  const v = key === 'bronco' ? parseBronco(text) : parsePositive(text);
  return v === undefined ? 'bad' : v;
};

const toText = (key: Exclude<keyof Form, 'group'>, v: number | null | undefined) =>
  v == null ? '' : key === 'bronco' ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : String(v);

// ---------- Testing days list ----------

const TestingDays: React.FC<Props> = ({ currentPlayer, sessions, results, onChanged }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('Testing day');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => [...sessions].sort((a, b) => b.date.localeCompare(a.date)), [sessions]);
  const open = sessions.find(s => s.id === openId);

  const handleCreate = async () => {
    if (!name.trim() || !date) return;
    setSaving(true);
    setError(null);
    try {
      const created = await db.addTestSession({ name: name.trim(), date, time: time || undefined, createdBy: currentPlayer.name, createdAt: Date.now() });
      await onChanged();
      setCreating(false);
      setOpenId(created.id);
    } catch (e) {
      console.error('[TestingDays] Could not create session:', e);
      setError('Could not create the testing day. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (open) {
    return <SessionPanel session={open} results={results.filter(r => r.sessionId === open.id)} currentPlayer={currentPlayer} onBack={() => setOpenId(null)} onChanged={onChanged} />;
  }

  return (
    <div className="space-y-3">
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm"
        >
          <Plus size={16} /> New testing day
        </button>
      ) : (
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name, e.g. Pre-season testing"
              className="flex-1 min-w-0 px-3 py-2 bg-black border border-neutral-700 rounded-lg text-sm text-white" />
          </div>
          <div className="flex gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-black border border-neutral-700 rounded-lg text-sm text-white" />
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="px-3 py-2 bg-black border border-neutral-700 rounded-lg text-sm text-white" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !name.trim() || !date}
              className="flex-1 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm disabled:opacity-40">
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !creating && (
        <p className="text-sm text-neutral-500 text-center py-6">No testing days yet. Create one to start entering results.</p>
      )}
      {sorted.map(s => {
        const count = results.filter(r => r.sessionId === s.id).length;
        return (
          <button key={s.id} onClick={() => setOpenId(s.id)}
            className="w-full flex items-center justify-between p-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-left">
            <div>
              <p className="text-white font-bold text-sm">{s.name}</p>
              <p className="text-xs text-neutral-500">{s.date}{s.time ? ` · ${formatClock(s.time)}` : ''} · by {s.createdBy}</p>
            </div>
            <span className="text-xs text-neutral-400">{count} player{count === 1 ? '' : 's'}</span>
          </button>
        );
      })}
    </div>
  );
};

// ---------- One testing day: players, entry, import ----------

interface SessionProps {
  session: TestSession;
  results: TestResult[];
  currentPlayer: Player;
  onBack: () => void;
  onChanged: () => Promise<void>;
}

const SessionPanel: React.FC<SessionProps> = ({ session, results, currentPlayer, onBack, onChanged }) => {
  const { isAlumniName, ready: alumniReady } = useAlumniNames();
  const { squadInfo, ready: classesReady } = useRosterClasses();
  const [query, setQuery] = useState('');
  const [squad, setSquad] = useState<'All' | 'Varsity' | 'JV'>('All');
  const [editing, setEditing] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const byName = useMemo(() => new Map(results.map(r => [r.nameKey, r])), [results]);
  const positions = useMemo(() => loadPositionOverrides(), []);
  const players = useMemo(() => ROSTER_PLAYERS
    .filter(p => !isAlumniName(p.name))
    .filter(p => squad === 'All' || squadInfo(p).squad === squad)
    .filter(p => !query.trim() || p.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [query, squad, alumniReady, classesReady]);

  const bestPositionOf = (name: string) =>
    positions[name]?.bestPosition ?? ROSTER_PLAYERS.find(p => p.name === name)?.bestPosition;

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
        <ArrowLeft size={16} /> Testing days
      </button>
      <div>
        <h2 className="text-xl font-bold text-white">{session.name}</h2>
        <p className="text-xs text-neutral-500">{session.date}{session.time ? ` · ${formatClock(session.time)}` : ''} · {results.length} player{results.length === 1 ? '' : 's'} entered</p>
      </div>
      <button onClick={() => setImporting(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-amber-400 hover:text-white">
        <ClipboardPaste size={16} /> Paste results from a sheet
      </button>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search players..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder-neutral-500" />
        </div>
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
          {(['All', 'Varsity', 'JV'] as const).map(s => (
            <button key={s} onClick={() => setSquad(s)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md ${squad === s ? 'bg-amber-500 text-black' : 'text-neutral-400'}`}>{s}</button>
          ))}
        </div>
      </div>

      {!alumniReady || !classesReady ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-neutral-500" /></div>
      ) : (
        <div className="space-y-1">
          {players.map(p => {
            const r = byName.get(normalizeName(p.name));
            const done = r ? TESTS.filter(t => scoreOf(r, t.key) !== undefined) : [];
            return (
              <button key={p.name} onClick={() => setEditing(p.name)}
                className="w-full flex items-center justify-between gap-3 p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-left">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-neutral-500 truncate">
                    {r ? `${groupLabel(r.group)} · ${done.map(t => `${t.label} ${formatValue(t.key, scoreOf(r, t.key)!)}`).join(' · ') || 'nothing yet'}` : 'Not entered'}
                  </p>
                </div>
                <span className={`text-xs flex-shrink-0 ${done.length === TESTS.length ? 'text-green-400' : 'text-neutral-500'}`}>
                  {done.length}/{TESTS.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {editing && (
        <EntryModal
          session={session}
          playerName={editing}
          existing={byName.get(normalizeName(editing))}
          defaultGroup={groupForPosition(bestPositionOf(editing))}
          currentPlayer={currentPlayer}
          onClose={() => setEditing(null)}
          onSaved={async () => { await onChanged(); setEditing(null); }}
        />
      )}
      {importing && (
        <ImportModal
          session={session}
          existing={byName}
          bestPositionOf={bestPositionOf}
          isAlumniName={isAlumniName}
          currentPlayer={currentPlayer}
          onClose={() => setImporting(false)}
          onDone={onChanged}
        />
      )}
    </div>
  );
};

// ---------- One player's entry ----------

interface EntryProps {
  session: TestSession;
  playerName: string;
  existing?: TestResult;
  defaultGroup?: PositionGroup;
  currentPlayer: Player;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const EntryModal: React.FC<EntryProps> = ({ session, playerName, existing, defaultGroup, currentPlayer, onClose, onSaved }) => {
  const [form, setForm] = useState<Form>(() => ({
    group: existing?.group ?? defaultGroup ?? '',
    ...Object.fromEntries(FIELDS.map(f => [f.key, toText(f.key, existing?.[f.key])])) as Omit<Form, 'group'>,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Object.fromEntries(FIELDS.map(f => [f.key, parseField(f.key, form[f.key])])) as Record<Exclude<keyof Form, 'group'>, number | null | 'bad'>;
  const badFields = FIELDS.filter(f => parsed[f.key] === 'bad');

  // Level preview for what's typed so far.
  const typed = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, v === 'bad' ? null : v])) as unknown as TestResult;
  const preview = form.group ? TESTS.map(t => ({ test: t, v: scoreOf(typed, t.key) })) : [];

  const handleSave = async () => {
    if (!form.group || badFields.length) return;
    setSaving(true);
    setError(null);
    try {
      const result: TestResult = {
        id: resultId(session.id, playerName),
        sessionId: session.id,
        nameKey: normalizeName(playerName),
        playerName,
        group: form.group,
        ...Object.fromEntries(FIELDS.map(f => [f.key, parsed[f.key]])),
        enteredBy: currentPlayer.name,
        updatedAt: Date.now(),
      } as TestResult;
      await db.saveTestResult(result);
      await onSaved();
    } catch (e) {
      console.error('[TestingDays] Could not save result:', e);
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-neutral-950 border border-neutral-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{playerName}</h3>
            <p className="text-xs text-neutral-500">{session.name} · {session.date}{session.time ? ` · ${formatClock(session.time)}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block">
            <span className="text-xs text-neutral-400">Position group (which standards apply)</span>
            <select value={form.group} onChange={e => setForm({ ...form, group: e.target.value as PositionGroup })}
              className="mt-1 w-full px-3 py-2 bg-black border border-neutral-700 rounded-lg text-sm text-white">
              <option value="">Choose…</option>
              {GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(f => (
              <label key={f.key} className="block">
                <span className="text-xs text-neutral-400">{f.label}</span>
                <input value={form[f.key]} inputMode="decimal" placeholder={f.hint}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className={`mt-1 w-full px-3 py-2 bg-black border rounded-lg text-sm text-white placeholder-neutral-600 ${
                    parsed[f.key] === 'bad' ? 'border-red-500' : 'border-neutral-700'}`} />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">Leave a box empty if the player didn't do that test.</p>
          {form.group && preview.some(p => p.v !== undefined) && (
            <div className="flex flex-wrap gap-2">
              {preview.filter(p => p.v !== undefined).map(p => (
                <span key={p.test.key} className="text-[11px] text-neutral-300 flex items-center gap-1">
                  {p.test.label} <LevelChip idx={levelIndex(form.group as PositionGroup, p.test.key, p.v!)} small />
                </span>
              ))}
            </div>
          )}
          {badFields.length > 0 && <p className="text-xs text-red-400">Check: {badFields.map(f => f.label).join(', ')}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={handleSave} disabled={saving || !form.group || badFields.length > 0}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">
            {saving ? 'Saving...' : !form.group ? 'Choose a position group' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- Paste from a sheet ----------

// Header names we recognise, lower-cased with spaces and punctuation removed.
const HEADER_ALIASES: Record<string, keyof Form | 'name'> = {
  name: 'name', player: 'name', playername: 'name',
  group: 'group', position: 'group', positiongroup: 'group',
  bodyweight: 'bodyweight', bw: 'bodyweight', weight: 'bodyweight', bodyweightlb: 'bodyweight',
  bronco: 'bronco',
  '10': 'sprint10', '10m': 'sprint10', '10ms': 'sprint10', sprint10: 'sprint10',
  '40': 'sprint40', '40m': 'sprint40', '40ms': 'sprint40', sprint40: 'sprint40',
  broad: 'broadJump', broadjump: 'broadJump', broadjumpin: 'broadJump', bj: 'broadJump',
  chin: 'chinupAdded', chinup: 'chinupAdded', chinupadded: 'chinupAdded', chinupaddedlb: 'chinupAdded', chinupaddedweight: 'chinupAdded',
  squat: 'squat3rm', squat3rm: 'squat3rm', squat3rmlb: 'squat3rm',
};
const headerKey = (h: string) => HEADER_ALIASES[h.toLowerCase().replace(/[^a-z0-9]/g, '')];

const groupFromText = (text: string): PositionGroup | undefined => {
  const t = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!t) return undefined;
  const n = parseInt(t);
  if (!isNaN(n) && String(n) === t) return groupForPosition(n as any);
  return GROUPS.find(g => g.key === t || g.key.startsWith(t) || g.label.toLowerCase().replace(/[^a-z]/g, '').startsWith(t))?.key;
};

interface ImportProps {
  session: TestSession;
  existing: Map<string, TestResult>;
  bestPositionOf: (name: string) => any;
  isAlumniName: (name: string) => boolean;
  currentPlayer: Player;
  onClose: () => void;
  onDone: () => Promise<void>;
}

const ImportModal: React.FC<ImportProps> = ({ session, existing, bestPositionOf, isAlumniName, currentPlayer, onClose, onDone }) => {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  const rosterByKey = useMemo(() => new Map(ROSTER_PLAYERS.map(p => [normalizeName(p.name), p.name])), []);

  // Parse pasted rows (tabs from Google Sheets, or commas). The first row must be headers.
  const plan = useMemo(() => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;
    const split = (l: string) => (l.includes('\t') ? l.split('\t') : l.split(',')).map(c => c.trim());
    const headers = split(lines[0]).map(headerKey);
    if (!headers.includes('name')) return { error: 'The first row needs a "Name" column.' } as const;
    const known = headers.filter(h => h && h !== 'name' && h !== 'group');
    if (known.length === 0) return { error: 'No test columns found. Use headers like Bronco, 10m, 40m, Broad jump, Bodyweight, Chin-up added, Squat.' } as const;
    const rows: { name: string; group?: PositionGroup; values: Partial<Record<string, number | null>> }[] = [];
    const unmatched: string[] = [];
    const problems: string[] = [];
    for (const line of lines.slice(1)) {
      const cells = split(line);
      const raw = cells[headers.indexOf('name')] ?? '';
      const name = rosterByKey.get(normalizeName(raw));
      if (!name) { if (raw) unmatched.push(raw); continue; }
      if (isAlumniName(name)) { problems.push(`${name} is alumni`); continue; }
      const values: Partial<Record<string, number | null>> = {};
      let group: PositionGroup | undefined;
      headers.forEach((h, i) => {
        if (!h || h === 'name') return;
        const cell = cells[i] ?? '';
        if (h === 'group') { group = groupFromText(cell); return; }
        const v = parseField(h as Exclude<keyof Form, 'group'>, cell);
        if (v === 'bad') problems.push(`${name}: "${cell}" in ${h}`);
        else if (v !== null) values[h] = v; // empty cells don't wipe what's already entered
      });
      rows.push({ name, group, values });
    }
    return { rows, unmatched, problems };
  }, [text, rosterByKey, isAlumniName]);

  const ready = plan && !('error' in plan) && plan.rows.length > 0;
  const noGroup = ready ? (plan as any).rows.filter((r: any) =>
    !r.group && !existing.get(normalizeName(r.name))?.group && !groupForPosition(bestPositionOf(r.name))).map((r: any) => r.name) : [];

  const handleImport = async () => {
    if (!ready) return;
    setSaving(true);
    setOutcome(null);
    const failed: string[] = [];
    let saved = 0;
    for (const row of (plan as any).rows) {
      const prev = existing.get(normalizeName(row.name));
      const group = row.group ?? prev?.group ?? groupForPosition(bestPositionOf(row.name));
      if (!group) continue;
      try {
        await db.saveTestResult({
          ...(prev ?? {}),
          ...row.values,
          id: resultId(session.id, row.name),
          sessionId: session.id,
          nameKey: normalizeName(row.name),
          playerName: row.name,
          group,
          enteredBy: currentPlayer.name,
          updatedAt: Date.now(),
        } as TestResult);
        saved++;
      } catch (e) {
        console.error('[TestingDays] Import failed for', row.name, e);
        failed.push(row.name);
      }
    }
    setSaving(false);
    setOutcome(failed.length
      ? { ok: false, message: `Saved ${saved}; failed: ${failed.join(', ')}` }
      : { ok: true, message: `Saved ${saved} player${saved === 1 ? '' : 's'}` });
    await onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-neutral-950 border border-neutral-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Paste results · {session.name}</h3>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-neutral-400">
            Copy the rows from your sheet, headers included, and paste below. Columns: Name, then any of Group, Bodyweight,
            Bronco (m:ss), 10m, 40m, Broad jump, Chin-up added, Squat. Empty cells leave what's already entered.
          </p>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder={'Name\tBronco\t10m\t40m\nJane Doe\t5:24\t1.81\t5.60'}
            className="w-full px-3 py-2 bg-black border border-neutral-700 rounded-lg text-xs text-white font-mono placeholder-neutral-600" />
          {plan && 'error' in plan && <p className="text-xs text-red-400">{plan.error}</p>}
          {plan && !('error' in plan) && (
            <div className="text-xs space-y-1">
              <p className="text-neutral-300">{plan.rows.length} player{plan.rows.length === 1 ? '' : 's'} matched to the roster.</p>
              {plan.unmatched.length > 0 && <p className="text-amber-400">Not on the roster (skipped): {plan.unmatched.join(', ')}</p>}
              {noGroup.length > 0 && <p className="text-amber-400">No position group (skipped; add a Group column or enter them one by one): {noGroup.join(', ')}</p>}
              {plan.problems.length > 0 && <p className="text-red-400">Couldn't read (left out): {plan.problems.join('; ')}</p>}
            </div>
          )}
          {outcome && (
            <div className={`p-2 rounded-lg flex items-center gap-2 text-sm ${outcome.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {outcome.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}{outcome.message}
            </div>
          )}
          <button onClick={handleImport} disabled={!ready || saving}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">
            {saving ? 'Saving...' : ready ? `Import ${(plan as any).rows.length - noGroup.length} player${(plan as any).rows.length - noGroup.length === 1 ? '' : 's'}` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestingDays;
