// Alumni: graduated players kept for the records.
//
// A player with alumniClass set is alumni. They keep their account and logs, drop off the
// current team's boards, and appear on the Alumni board with their all-time bests.
import { Player, WorkoutLog } from '../types';
import { PROGRAM } from './programData';
import { HEADLINE_LIFTS, TIMED_TESTS, computePlayerStats, formatSeconds, isAdvancedLog } from './advancedStats';

export const isAlumni = (p: Player) => p.alumniClass !== undefined && p.alumniClass !== null;

// The most recent graduation: from June on, this year's class; before June, last year's.
export const defaultAlumniClass = (now = new Date()) =>
  now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;

export interface AlumniEntry {
  player: Player;
  value: number;
  display: string;
}

export interface AlumniRecord {
  key: string;
  label: string;
  program: 'Intermediate' | 'Advanced';
  lowerIsBetter: boolean;
  entries: AlumniEntry[]; // best first
}

const positive = (v: string | undefined) => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

// All-time bests for the given alumni, one record list per lift or test, best first.
// Lists nobody has logged are left out.
export const alumniRecords = (alumni: Player[], allLogs: WorkoutLog[]): AlumniRecord[] => {
  const logsOf = new Map<string, WorkoutLog[]>();
  for (const log of allLogs) logsOf.set(log.playerId, [...(logsOf.get(log.playerId) ?? []), log]);

  const records: AlumniRecord[] = [];

  // Intermediate: every lift and sprint in the 4-day program.
  for (const day of PROGRAM.DAYS) {
    for (const ex of day.exercises) {
      if (!ex.isMetric && !ex.isSprint) continue;
      const field = ex.isSprint ? 'time' : 'weight';
      const entries: AlumniEntry[] = [];
      for (const player of alumni) {
        let best: number | undefined;
        for (const log of logsOf.get(player.id) ?? []) {
          if (isAdvancedLog(log) || !log.data) continue;
          const v = positive(log.data[`${ex.id}_${field}`]);
          if (v === undefined) continue;
          if (best === undefined || (ex.isSprint ? v < best : v > best)) best = v;
        }
        if (best !== undefined) entries.push({ player, value: best, display: ex.isSprint ? `${best}s` : `${best} lbs` });
      }
      if (entries.length === 0) continue;
      entries.sort((a, b) => (ex.isSprint ? a.value - b.value : b.value - a.value));
      records.push({ key: ex.id, label: `${ex.name} (${day.title})`, program: 'Intermediate', lowerIsBetter: !!ex.isSprint, entries });
    }
  }

  // Advanced: headline lifts and the McCaw / Bronco tests. A far-future date counts every week.
  const stats = alumni.map(player => ({ player, stats: computePlayerStats(logsOf.get(player.id) ?? [], '9999-12-31') }));
  for (const lift of HEADLINE_LIFTS) {
    const entries = stats
      .filter(s => s.stats.bestLift[lift.key] !== undefined)
      .map(s => ({ player: s.player, value: s.stats.bestLift[lift.key]!, display: `${s.stats.bestLift[lift.key]} lbs` }))
      .sort((a, b) => b.value - a.value);
    if (entries.length) records.push({ key: `adv_${lift.key}`, label: lift.label, program: 'Advanced', lowerIsBetter: false, entries });
  }
  for (const test of TIMED_TESTS) {
    const entries = stats
      .filter(s => s.stats.bestTest[test.key] !== undefined)
      .map(s => ({ player: s.player, value: s.stats.bestTest[test.key]!, display: formatSeconds(s.stats.bestTest[test.key]!) }))
      .sort((a, b) => a.value - b.value);
    if (entries.length) records.push({ key: `adv_${test.key}`, label: test.label, program: 'Advanced', lowerIsBetter: true, entries });
  }

  return records;
};
