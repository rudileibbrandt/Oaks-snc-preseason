// The current season. Stat boards, leaderboards and the Tracker only count workouts from here on.
// Older logs are kept: the Alumni board and each player's own workout history still use them.
import { WorkoutLog } from '../types';
import { WeekIdentifier, compareWeekIdentifiers, getISOWeek, getISOWeekFromTimestamp } from '../utils/weekUtils';

export const SEASON_START = '2026-11-02'; // Mon 2 Nov 2026, the start of the Advanced program

// Noon, so the date can't slip a day across time zones.
const seasonStartWeek: WeekIdentifier = getISOWeek(new Date(`${SEASON_START}T12:00:00`));

const weekOf = (log: WorkoutLog): WeekIdentifier =>
  log.weekYear !== undefined && log.week !== undefined
    ? { year: log.weekYear, week: log.week }
    : getISOWeekFromTimestamp(log.timestamp);

// Logs are counted by the training week they belong to, so a late entry for an old week stays out.
export const isThisSeason = (log: WorkoutLog) => compareWeekIdentifiers(weekOf(log), seasonStartWeek) >= 0;

export const thisSeasonOnly = (logs: WorkoutLog[]) => logs.filter(isThisSeason);
