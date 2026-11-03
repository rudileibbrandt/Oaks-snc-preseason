// Completion % on the Intermediate Stat Board. Pure, tested in intermediateCompletion.test.ts.
// Counts program weeks only. A finished week expects all 4 sessions. The current week has no set
// weekdays on Intermediate, so it only adds the sessions already done (none of it is "missed" yet).
import type { WorkoutLog } from '../types';
import { compareWeekIdentifiers, getISOWeekFromTimestamp } from '../utils/weekUtils.ts';
import type { WeekIdentifier } from '../utils/weekUtils.ts';

const weekOf = (log: WorkoutLog): WeekIdentifier =>
  log.weekYear !== undefined && log.week !== undefined
    ? { year: log.weekYear, week: log.week }
    : getISOWeekFromTimestamp(log.timestamp);

// null means nothing is due yet and nothing is done: the board shows "–".
export const intermediateCompletionRate = (
  playerLogs: WorkoutLog[],
  programWeeks: WeekIdentifier[], // in date order
  currentWeek: WeekIdentifier,
  dayIds: string[],
): number | null => {
  let possible = 0;
  let done = 0;
  for (const week of programWeeks) {
    const order = compareWeekIdentifiers(week, currentWeek);
    if (order > 0) break;
    const doneDays = new Set(
      playerLogs
        .filter(l => l.completed && dayIds.includes(l.dayId) && compareWeekIdentifiers(weekOf(l), week) === 0)
        .map(l => l.dayId),
    );
    done += doneDays.size;
    possible += order < 0 ? dayIds.length : doneDays.size;
  }
  return possible > 0 ? Math.round((done / possible) * 100) : null;
};
