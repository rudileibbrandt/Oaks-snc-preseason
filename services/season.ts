// The current season. Stat boards, leaderboards and the Tracker only count workouts from here on.
// Older logs are kept: the Alumni board and each player's own workout history still use them.
import { TeamGoal, WorkoutLog } from '../types';
import { WeekIdentifier, compareWeekIdentifiers, getISOWeek, getISOWeekFromTimestamp } from '../utils/weekUtils';

export const SEASON_START = '2026-11-02'; // Mon 2 Nov 2026, the start of the Advanced program
// Testing counts from the try-out testing on Sun 25 Oct (Rudi, 8 Nov: those results are the
// season's starting point). The next testing day is Sun 8 Nov.
export const TESTING_SEASON_START = '2026-10-25';

// Noon, so the date can't slip a day across time zones.
const seasonStartWeek: WeekIdentifier = getISOWeek(new Date(`${SEASON_START}T12:00:00`));

const weekOf = (log: WorkoutLog): WeekIdentifier =>
  log.weekYear !== undefined && log.week !== undefined
    ? { year: log.weekYear, week: log.week }
    : getISOWeekFromTimestamp(log.timestamp);

// Logs are counted by the training week they belong to, so a late entry for an old week stays out.
export const isThisSeason = (log: WorkoutLog) => compareWeekIdentifiers(weekOf(log), seasonStartWeek) >= 0;

export const thisSeasonOnly = (logs: WorkoutLog[]) => logs.filter(isThisSeason);

// The team goal until a coach sets one on the Team tab (Rudi, 22 Nov 2026): every player at Bronze
// on the Bronco by 4 Jan 2027. The other tests are measured for improvement, not goaled.
export const DEFAULT_GOAL: TeamGoal = { test: 'bronco', level: 0, squad: 'All', count: null, by: '2027-01-04' };

// "Within reach" of the goal line, per test: shown as "11 within 20 s".
export const GOAL_REACH: Record<TeamGoal['test'], number> = {
  bronco: 20, sprint10: 0.1, sprint40: 0.2, broadJump: 5, chinup: 10, chinupReps: 10, squat3rm: 15,
};
