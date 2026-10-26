import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Plus, X, MapPin, Clock, Medal, Dumbbell, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { AppView, Player, TeamEvent, TeamEventType, TestSession, WorkoutLog } from '../types';
import { db } from '../services/db';
import { PROGRAM, PROGRAM_DATES_LABEL } from '../services/programData';
import { advancedDayOn, formatClock, isoDate, logDate, monthGrid, parseIso, programWeekOn, weekOfIso } from '../services/calendar';
import { isAdvancedLog } from '../services/advancedStats';
import { openStandardsOn } from './StandardsView';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

const EVENT_STYLE: Record<TeamEventType, { dot: string; chip: string }> = {
  Practice: { dot: 'bg-sky-400', chip: 'bg-sky-500/15 text-sky-300' },
  Match: { dot: 'bg-red-400', chip: 'bg-red-500/15 text-red-300' },
  Other: { dot: 'bg-neutral-400', chip: 'bg-neutral-700 text-neutral-200' },
};
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const longDate = (iso: string) =>
  parseIso(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

const CalendarView: React.FC<Props> = ({ onNavigate, currentPlayer }) => {
  const isCoach = currentPlayer?.role === 'Coach';
  const program = currentPlayer?.program ?? 'Intermediate';
  const today = isoDate(new Date());

  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<TeamEvent> | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ev, ts, lg] = await Promise.all([
        db.getEvents(),
        db.getTestSessions(),
        !isCoach && currentPlayer?.id ? db.getPlayerLogs(currentPlayer.id) : Promise.resolve([] as WorkoutLog[]),
      ]);
      setEvents(ev);
      setSessions(ts);
      setLogs(lg);
      setError(null);
    } catch (e) {
      console.error('[CalendarView] Could not load calendar:', e);
      setError('Could not load the calendar. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [isCoach, currentPlayer?.id]);
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => monthGrid(month.y, month.m), [month]);
  const eventsOn = useMemo(() => {
    const map = new Map<string, TeamEvent[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    for (const list of map.values()) list.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    return map;
  }, [events]);
  const testsOn = useMemo(() => {
    const map = new Map<string, TestSession[]>();
    for (const s of sessions) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [sessions]);
  // Everything from today on, soonest first: testing days and events together.
  const upcoming = useMemo(() => [
    ...sessions.map(t => ({ kind: 'test' as const, id: t.id, date: t.date, time: t.time, test: t })),
    ...events.map(e => ({ kind: 'event' as const, id: e.id, date: e.date, time: e.startTime, event: e })),
  ].filter(x => x.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')),
  [sessions, events, today]);

  const doneOn = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const l of logs) if (l.completed) map.set(logDate(l), [...(map.get(logDate(l)) ?? []), l]);
    return map;
  }, [logs]);

  // Intermediate: how many of Days 1–4 the player has done in a week.
  const intermediateDoneInWeek = (iso: string) => {
    const wk = weekOfIso(iso);
    const ids = new Set(logs.filter(l => l.completed && !isAdvancedLog(l) && l.weekYear === wk.year && l.week === wk.week).map(l => l.dayId));
    return PROGRAM.DAYS.filter(d => ids.has(d.id)).length;
  };

  // Show the Advanced plan to coaches and Advanced players.
  const showAdvanced = isCoach || program === 'Advanced';
  const showIntermediate = isCoach || program === 'Intermediate';

  const shiftMonth = (delta: number) => setMonth(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const sel = {
    events: eventsOn.get(selected) ?? [],
    tests: testsOn.get(selected) ?? [],
    advanced: showAdvanced ? advancedDayOn(selected) : undefined,
    week: programWeekOn(selected),
    done: doneOn.get(selected) ?? [],
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('LANDING')} className="p-2 -ml-2 text-neutral-400 hover:text-white"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><CalendarDays size={22} className="text-amber-400" />Calendar</h1>
          <p className="text-xs text-neutral-500">Practices, matches, testing days and your S&C sessions</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Month */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 text-neutral-400 hover:text-white"><ChevronLeft size={18} /></button>
          <button onClick={() => { const d = new Date(); setMonth({ y: d.getFullYear(), m: d.getMonth() }); setSelected(today); }}
            className="text-sm font-bold text-white">{monthLabel}</button>
          <button onClick={() => shiftMonth(1)} className="p-1.5 text-neutral-400 hover:text-white"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map(d => <div key={d} className="text-[10px] uppercase text-neutral-500 py-1">{d}</div>)}
          {days.map(iso => {
            const inMonth = parseIso(iso).getMonth() === month.m;
            const isSel = iso === selected;
            const dots = [
              ...(testsOn.has(iso) ? ['bg-amber-400'] : []),
              ...(eventsOn.get(iso) ?? []).map(e => EVENT_STYLE[e.type].dot),
            ].slice(0, 3);
            const planned = showAdvanced && !!advancedDayOn(iso)?.day.exercises.length;
            return (
              <button key={iso} onClick={() => setSelected(iso)}
                className={`relative h-12 rounded-lg flex flex-col items-center justify-start pt-1 transition-colors ${
                  isSel ? 'bg-amber-500/25 border border-amber-500/60' : 'hover:bg-neutral-800 border border-transparent'
                } ${inMonth ? '' : 'opacity-40'}`}>
                <span className={`text-xs ${iso === today ? 'font-black text-amber-400' : 'text-neutral-200'}`}>{parseIso(iso).getDate()}</span>
                <div className="flex gap-0.5 mt-0.5">{dots.map((c, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${c}`} />)}</div>
                {planned && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded bg-neutral-500" />}
                {doneOn.has(iso) && <CheckCircle2 size={10} className="absolute top-1 right-1 text-green-400" />}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-neutral-500">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Testing</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400" />Practice</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Match</span>
          {showAdvanced && <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-neutral-500" />Advanced session</span>}
          {!isCoach && <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-green-400" />Workout done</span>}
        </div>
      </div>

      {/* Selected day */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">{longDate(selected)}{selected === today && <span className="text-amber-400"> · Today</span>}</h2>
          {isCoach && (
            <button onClick={() => setEditing({ type: 'Practice', title: 'Practice', date: selected })}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold">
              <Plus size={14} /> Add
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-neutral-500" /></div>
        ) : (
          <>
            {sel.tests.map(t => (
              <button key={t.id} onClick={() => {
                // Held (today or earlier): results. Still to come: the standards, or the session for coaches.
                const held = t.date <= today;
                openStandardsOn(held ? (isCoach ? 'team' : 'mine') : (isCoach ? 'testing' : 'tables'));
                onNavigate('STANDARDS');
              }}
                className="w-full p-3 bg-neutral-900 border border-amber-500/30 rounded-lg text-left flex items-center gap-3">
                <Medal size={18} className="text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-bold">{t.name}</p>
                  <p className="text-[11px] text-neutral-400">Testing day{t.time ? ` · ${formatClock(t.time)}` : ''} · {t.date <= today ? (isCoach ? 'see team results' : 'see your results') : 'see the standards'}</p>
                </div>
              </button>
            ))}

            {sel.events.map(e => (
              <div key={e.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${EVENT_STYLE[e.type].chip}`}>{e.type}</span>
                      <p className="text-sm text-white font-bold truncate">{e.title}</p>
                    </div>
                    {(e.startTime || e.location) && (
                      <p className="text-[11px] text-neutral-400 mt-1 flex flex-wrap gap-x-3">
                        {e.startTime && <span className="flex items-center gap-1"><Clock size={11} />{formatClock(e.startTime)}{e.endTime ? `–${formatClock(e.endTime)}` : ''}</span>}
                        {e.location && <span className="flex items-center gap-1"><MapPin size={11} />{e.location}</span>}
                      </p>
                    )}
                    {e.notes && <p className="text-[11px] text-neutral-400 mt-1 whitespace-pre-wrap">{e.notes}</p>}
                  </div>
                  {isCoach && <button onClick={() => setEditing(e)} className="text-xs text-neutral-400 hover:text-white flex-shrink-0">Edit</button>}
                </div>
              </div>
            ))}

            {sel.advanced && (
              <button onClick={() => !isCoach && onNavigate('ATHLETE_SELECT')} disabled={isCoach}
                className="w-full p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-left flex items-start gap-3">
                <Dumbbell size={18} className="text-neutral-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-white font-bold">Advanced · Week {sel.advanced.week}</p>
                  <p className="text-[11px] text-neutral-400">
                    {sel.advanced.day.exercises.length
                      ? sel.advanced.day.exercises.map(x => x.name).join(' · ')
                      : `Rest day${sel.advanced.day.restNote ? ` · ${sel.advanced.day.restNote}` : ''}`}
                  </p>
                </div>
              </button>
            )}

            {showIntermediate && sel.week !== undefined && (
              <button onClick={() => !isCoach && onNavigate('ATHLETE_SELECT')} disabled={isCoach}
                className="w-full p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-left flex items-start gap-3">
                <Dumbbell size={18} className="text-neutral-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-bold">Intermediate · Week {sel.week}</p>
                  <p className="text-[11px] text-neutral-400">
                    Days 1–4, any 4 days this week{!isCoach && ` · ${intermediateDoneInWeek(selected)} of 4 done`}
                  </p>
                </div>
              </button>
            )}

            {!isCoach && sel.done.length > 0 && (
              <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={14} />You logged {sel.done.length} workout{sel.done.length === 1 ? '' : 's'} this day</p>
            )}

            {sel.tests.length + sel.events.length === 0 && !sel.advanced && (sel.week === undefined || !showIntermediate) && sel.done.length === 0 && (
              <p className="text-sm text-neutral-500 py-2">
                Nothing scheduled.{sel.week === undefined && ` S&C programs run ${PROGRAM_DATES_LABEL}.`}
              </p>
            )}
          </>
        )}
      </div>

      {/* Coming up */}
      {!loading && (
        <div className="space-y-2 pt-2">
          <h2 className="text-sm font-bold text-white">Coming up</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing scheduled yet.</p>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl divide-y divide-neutral-800">
              {(showAllUpcoming ? upcoming : upcoming.slice(0, 10)).map(x => {
                const d = parseIso(x.date);
                return (
                  <button key={x.kind + x.id}
                    onClick={() => { setMonth({ y: d.getFullYear(), m: d.getMonth() }); setSelected(x.date); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-neutral-800/60 transition-colors">
                    <div className="w-11 flex-shrink-0 text-center">
                      <div className="text-[10px] uppercase text-neutral-500">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className={`text-lg font-black leading-tight ${x.date === today ? 'text-amber-400' : 'text-white'}`}>{d.getDate()}</div>
                      <div className="text-[10px] uppercase text-neutral-500">{d.toLocaleDateString('en-US', { month: 'short' })}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {x.kind === 'test'
                          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">Testing</span>
                          : <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${EVENT_STYLE[x.event.type].chip}`}>{x.event.type}</span>}
                        <p className="text-sm text-white font-bold truncate">{x.kind === 'test' ? x.test.name : x.event.title}</p>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 flex flex-wrap gap-x-3">
                        {x.time && <span className="flex items-center gap-1"><Clock size={11} />{formatClock(x.time)}{x.kind === 'event' && x.event.endTime ? `–${formatClock(x.event.endTime)}` : ''}</span>}
                        {x.kind === 'event' && x.event.location && <span className="flex items-center gap-1"><MapPin size={11} />{x.event.location}</span>}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-neutral-600 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          {upcoming.length > 10 && (
            <button onClick={() => setShowAllUpcoming(v => !v)} className="text-xs text-amber-400 hover:text-amber-300">
              {showAllUpcoming ? 'Show fewer' : `Show all ${upcoming.length}`}
            </button>
          )}
        </div>
      )}

      {editing && currentPlayer && (
        <EventModal event={editing} currentPlayer={currentPlayer} onClose={() => setEditing(null)}
          onSaved={async date => { await load(); setEditing(null); if (date) setSelected(date); }} />
      )}
    </div>
  );
};

// ---------- Add or edit an event (coaches) ----------

interface EventProps {
  event: Partial<TeamEvent>;
  currentPlayer: Player;
  onClose: () => void;
  onSaved: (date?: string) => Promise<void>;
}

const EventModal: React.FC<EventProps> = ({ event, currentPlayer, onClose, onSaved }) => {
  const [kind, setKind] = useState<TeamEventType | 'Testing'>(event.type ?? 'Practice');
  const [title, setTitle] = useState(event.title ?? 'Practice');
  const [date, setDate] = useState(event.date ?? isoDate(new Date()));
  const [startTime, setStartTime] = useState(event.startTime ?? '');
  const [endTime, setEndTime] = useState(event.endTime ?? '');
  const [location, setLocation] = useState(event.location ?? '');
  const [notes, setNotes] = useState(event.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = !event.id;

  // Changing the kind fills in a default title, unless the coach already typed one.
  const pickKind = (k: TeamEventType | 'Testing') => {
    const defaults = ['Practice', 'Match', 'Event', 'Testing day', ''];
    if (defaults.includes(title)) setTitle(k === 'Match' ? 'Match' : k === 'Other' ? 'Event' : k === 'Testing' ? 'Testing day' : 'Practice');
    if (k === 'Testing' && !startTime) setStartTime('09:00'); // testing days are Sundays at 9
    setKind(k);
  };

  const handleSave = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === 'Testing') {
        await db.addTestSession({ name: title.trim(), date, time: startTime || undefined, createdBy: currentPlayer.name, createdAt: Date.now() });
      } else {
        await db.saveEvent({
          ...(event.id ? { id: event.id } : {}),
          type: kind, title: title.trim(), date,
          startTime: startTime || undefined, endTime: endTime || undefined,
          location: location.trim() || undefined, notes: notes.trim() || undefined,
          createdBy: event.createdBy ?? currentPlayer.name, updatedAt: Date.now(),
        });
      }
      await onSaved(date);
    } catch (e) {
      console.error('[CalendarView] Could not save:', e);
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event.id) return;
    setSaving(true);
    try {
      await db.deleteEvent(event.id);
      await onSaved();
    } catch (e) {
      console.error('[CalendarView] Could not delete:', e);
      setError('Could not delete. Check your connection and try again.');
      setSaving(false);
    }
  };

  const input = 'mt-1 w-full px-3 py-2 bg-black border border-neutral-700 rounded-lg text-sm text-white';
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-neutral-950 border border-neutral-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{isNew ? 'Add to calendar' : 'Edit event'}</h3>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
            {(isNew ? ['Practice', 'Match', 'Testing', 'Other'] as const : ['Practice', 'Match', 'Other'] as const).map(k => (
              <button key={k} onClick={() => pickKind(k)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md ${kind === k ? 'bg-amber-500 text-black' : 'text-neutral-400'}`}>
                {k === 'Testing' ? 'Testing day' : k}
              </button>
            ))}
          </div>
          <label className="block"><span className="text-xs text-neutral-400">Title</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'Match' ? 'e.g. vs Monte Vista' : ''} className={input} />
          </label>
          <label className="block"><span className="text-xs text-neutral-400">Date</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} />
          </label>
          {kind !== 'Testing' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-neutral-400">Start</span>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={input} />
                </label>
                <label className="block"><span className="text-xs text-neutral-400">End</span>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={input} />
                </label>
              </div>
              <label className="block"><span className="text-xs text-neutral-400">Where</span>
                <input value={location} onChange={e => setLocation(e.target.value)} className={input} />
              </label>
              <label className="block"><span className="text-xs text-neutral-400">Notes</span>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={input} />
              </label>
            </>
          )}
          {kind === 'Testing' && (
            <label className="block"><span className="text-xs text-neutral-400">Start</span>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={input} />
            </label>
          )}
          {kind === 'Testing' && <p className="text-[11px] text-neutral-500">Creates a testing day in S&C Standards, where you enter results.</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={handleSave} disabled={saving || !title.trim() || !date}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">
            {saving ? 'Saving...' : 'Save'}
          </button>
          {!isNew && (
            confirmDelete ? (
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm">Keep it</button>
                <button onClick={handleDelete} disabled={saving} className="flex-1 py-2 rounded-lg bg-red-600 text-white font-bold text-sm">Delete event</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="w-full py-2 rounded-lg text-red-400 text-sm flex items-center justify-center gap-1">
                <Trash2 size={14} /> Delete
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
