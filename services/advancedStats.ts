// Stat Board numbers for the Advanced program.
//
// Advanced exercise ids are per day (adv_w3_mon_1), so the same lift has a different id
// each week. Everything here works from the program data: which day a log belongs to comes
// from its dayId, and which headline lift an exercise is comes from its name.
import { ExerciseDef, Player, WorkoutDay, WorkoutLog } from '../types';
import { ADVANCED_WEEKS } from './advancedProgram';

// ---------- Program lookups ----------

interface DayInfo {
  week: number; // program week 1–7
  day: WorkoutDay;
}

const DAY_INFO = new Map<string, DayInfo>();
const EXERCISE_DEFS = new Map<string, ExerciseDef>();
for (const w of ADVANCED_WEEKS) {
  for (const day of w.days) {
    DAY_INFO.set(day.id, { week: w.week, day });
    for (const ex of day.exercises) EXERCISE_DEFS.set(ex.id, ex);
  }
}

export const isAdvancedLog = (log: WorkoutLog) => DAY_INFO.has(log.dayId);
export const advancedWeekOfLog = (log: WorkoutLog) => DAY_INFO.get(log.dayId)?.week;

// A day has a session to log unless it is a rest day with nothing on it.
export const isSessionDay = (day: WorkoutDay) => day.exercises.length > 0;

// ---------- Headline lifts and tests ----------

export const HEADLINE_LIFTS = [
  { key: 'frontSquat', label: 'Front Squat', match: /^front squat/i },
  { key: 'hangClean', label: 'Hang Clean', match: /^hang clean$/i },
  { key: 'bench', label: 'Bench', match: /^(barbell )?bench press/i },
  { key: 'deadlift', label: 'Deadlift', match: /^barbell deadlift/i },
  { key: 'backSquat', label: 'Back Squat', match: /^(barbell )?back squat/i },
  { key: 'hangPowerSnatch', label: 'Hang Power Snatch', match: /^hang power snatch/i },
] as const;
export type LiftKey = typeof HEADLINE_LIFTS[number]['key'];

export const TIMED_TESTS = [
  { key: 'mccaw', label: 'McCaw', match: /^mccaw$/i },
  { key: 'bronco', label: 'Bronco', match: /^bronco/i },
] as const;
export type TestKey = typeof TIMED_TESTS[number]['key'];

const liftKeyOf = (ex: ExerciseDef): LiftKey | undefined =>
  ex.isMetric ? HEADLINE_LIFTS.find(l => l.match.test(ex.name))?.key : undefined;
const testKeyOf = (ex: ExerciseDef): TestKey | undefined =>
  ex.logType === 'timed' ? TIMED_TESTS.find(t => t.match.test(ex.name))?.key : undefined;

// ---------- Reading logged values ----------

// A positive number, or undefined for blank, zero or junk.
const num = (v: string | undefined): number | undefined => {
  if (v === undefined || v === '') return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

// Finish time in seconds for a timed test, or undefined if nothing was entered.
const timeSeconds = (data: Record<string, string>, exId: string): number | undefined => {
  const m = num(data[`${exId}_timeMin`]) ?? 0;
  const s = num(data[`${exId}_timeSec`]) ?? 0;
  const total = m * 60 + s;
  return total > 0 ? total : undefined;
};

export const formatSeconds = (total: number) =>
  `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`;

// Exercises in a log's day, paired with their definitions.
const exercisesOf = (log: WorkoutLog): ExerciseDef[] => DAY_INFO.get(log.dayId)?.day.exercises ?? [];

// Training load for one log: minutes × effort, summed over runs, recovery and Team Training.
// Lifting and timed tests are not timed with an effort score, so they add nothing.
export const logLoad = (log: WorkoutLog): number => {
  if (!log.data) return 0;
  let load = 0;
  for (const ex of exercisesOf(log)) {
    if (ex.logType !== 'cardio' && ex.logType !== 'session') continue;
    const minutes = num(log.data[`${ex.id}_minutes`]);
    const rpe = num(log.data[`${ex.id}_rpe`]);
    if (minutes !== undefined && rpe !== undefined) load += minutes * rpe;
  }
  return load;
};

// Did the player enter anything in this log? (Lift fields default to "0", so ignore zeros.)
const hasAnyEntry = (log: WorkoutLog) =>
  Object.values(log.data || {}).some(v => num(v) !== undefined) || !!log.customWorkout;

// ---------- Per-player stats ----------

export type DayStatus = 'complete' | 'partial' | 'empty' | 'rest';

export interface PlayerStats {
  bestLift: Partial<Record<LiftKey, number>>; // lbs
  bestTest: Partial<Record<TestKey, number>>; // seconds, lower is better
  runMiles: number;
  sessionsDone: number;
  sessionsScheduled: number; // session days dated on or before today
  completionRate: number | null; // % of scheduled sessions done; null before the program starts
  loadByWeek: Record<number, number>; // program week -> load
  bestLiftByWeek: Record<number, Partial<Record<LiftKey, number>>>;
}

// Advanced logs for one player, keyed by dayId (the latest save wins if there are several).
const logsByDay = (playerLogs: WorkoutLog[]) => {
  const map = new Map<string, WorkoutLog>();
  for (const log of playerLogs) {
    if (!isAdvancedLog(log)) continue;
    const prev = map.get(log.dayId);
    if (!prev || log.timestamp >= prev.timestamp) map.set(log.dayId, log);
  }
  return map;
};

export const dayStatus = (day: WorkoutDay, log: WorkoutLog | undefined): DayStatus => {
  if (!isSessionDay(day)) return 'rest';
  if (!log) return 'empty';
  if (log.completed) return 'complete';
  return hasAnyEntry(log) ? 'partial' : 'empty';
};

export const computePlayerStats = (playerLogs: WorkoutLog[], todayIso: string): PlayerStats => {
  const byDay = logsByDay(playerLogs);
  const stats: PlayerStats = {
    bestLift: {}, bestTest: {}, runMiles: 0, sessionsDone: 0, sessionsScheduled: 0,
    completionRate: null, loadByWeek: {}, bestLiftByWeek: {},
  };

  for (const w of ADVANCED_WEEKS) {
    for (const day of w.days) {
      if (!isSessionDay(day)) continue;
      const log = byDay.get(day.id);
      if (day.date && day.date <= todayIso) {
        stats.sessionsScheduled++;
        if (log?.completed) stats.sessionsDone++;
      } else if (log?.completed) {
        // Logged ahead of schedule: count it as done and scheduled.
        stats.sessionsScheduled++;
        stats.sessionsDone++;
      }
      if (!log?.data) continue;

      stats.loadByWeek[w.week] = (stats.loadByWeek[w.week] ?? 0) + logLoad(log);

      for (const ex of day.exercises) {
        const lift = liftKeyOf(ex);
        if (lift) {
          const weight = num(log.data[`${ex.id}_weight`]);
          if (weight !== undefined) {
            stats.bestLift[lift] = Math.max(stats.bestLift[lift] ?? 0, weight);
            const wk = (stats.bestLiftByWeek[w.week] ??= {});
            wk[lift] = Math.max(wk[lift] ?? 0, weight);
          }
        }
        const test = testKeyOf(ex);
        if (test) {
          const t = timeSeconds(log.data, ex.id);
          if (t !== undefined) stats.bestTest[test] = Math.min(stats.bestTest[test] ?? Infinity, t);
        }
        if (ex.logType === 'cardio') stats.runMiles += num(log.data[`${ex.id}_distance`]) ?? 0;
      }
    }
  }

  stats.runMiles = Math.round(stats.runMiles * 10) / 10;
  stats.completionRate = stats.sessionsScheduled > 0
    ? Math.round((stats.sessionsDone / stats.sessionsScheduled) * 100)
    : null;
  return stats;
};

// Who belongs on the Advanced board: players on Advanced now, plus anyone with Advanced logs.
export const advancedPlayers = (players: Player[], allLogs: WorkoutLog[]) => {
  const withLogs = new Set(allLogs.filter(isAdvancedLog).map(l => l.playerId));
  return players.filter(p => p.program === 'Advanced' || withLogs.has(p.id));
};

// Total load and the number of program weeks that had any logging, for averages.
export const totalLoad = (s: PlayerStats) => Object.values(s.loadByWeek).reduce((a, b) => a + b, 0);
export const avgWeeklyLoad = (s: PlayerStats) => {
  const weeks = Object.values(s.loadByWeek).filter(v => v > 0).length;
  return weeks > 0 ? Math.round(totalLoad(s) / weeks) : 0;
};

// Rank for the Completed and Performers views: completion first, then total training load.
export const compareByCompletionThenLoad = (a: PlayerStats, b: PlayerStats) =>
  (b.completionRate ?? -1) - (a.completionRate ?? -1) || totalLoad(b) - totalLoad(a);

// Text shown for one logged exercise in the player detail view.
export const describeEntry = (ex: ExerciseDef, data: Record<string, string>): string | undefined => {
  const v = (f: string) => num(data[`${ex.id}_${f}`]);
  if (ex.logType === 'timed') {
    const t = timeSeconds(data, ex.id);
    return t !== undefined ? formatSeconds(t) : undefined;
  }
  if (ex.logType) {
    const parts = [
      v('minutes') !== undefined && `${v('minutes')} min`,
      ex.logType === 'cardio' && v('distance') !== undefined && `${v('distance')} mi`,
      v('rpe') !== undefined && `effort ${v('rpe')}`,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (ex.isMetric) {
    const weight = v('weight');
    const sets = v('sets');
    const reps = v('reps');
    if (weight === undefined && sets === undefined && reps === undefined) return undefined;
    return [weight !== undefined && `${weight} lbs`, sets !== undefined && reps !== undefined && `${sets}×${reps}`]
      .filter(Boolean).join(' · ') || undefined;
  }
  return undefined;
};

export const latestLogForDay = (playerLogs: WorkoutLog[], dayId: string) => logsByDay(playerLogs).get(dayId);
