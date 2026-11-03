// Run: npm test  (Node's built-in test runner, no extra packages)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intermediateCompletionRate } from './intermediateCompletion.ts';
import type { WorkoutLog } from '../types.ts';
import type { WeekIdentifier } from '../utils/weekUtils.ts';

const DAYS = ['day1', 'day2', 'day3', 'day4'];
const wk = (week: number): WeekIdentifier => ({ year: 2026, week });
const PROGRAM_WEEKS = [45, 46, 47, 48, 49, 50, 51].map(wk); // Mon 2 Nov – Sun 20 Dec 2026
const log = (week: number, dayId: string, completed = true): WorkoutLog => ({
  playerId: 'p1', dayId, timestamp: 0, weekYear: 2026, week, data: {}, completed,
});
const rate = (logs: WorkoutLog[], current: number) =>
  intermediateCompletionRate(logs, PROGRAM_WEEKS, wk(current), DAYS);

test('first week: two sessions done shows 100%, not 6%', () => {
  assert.equal(rate([log(45, 'day1'), log(45, 'day2')], 45), 100);
});

test('nothing due yet and nothing done shows no rate', () => {
  assert.equal(rate([], 45), null);
});

test('a finished week counts all 4 sessions', () => {
  // Week 45: 2 of 4. Week 46 so far: 1 done.
  assert.equal(rate([log(45, 'day1'), log(45, 'day2'), log(46, 'day1')], 46), 60); // 3 of 5
});

test('a week with nothing logged counts as 0 of 4 once it is over', () => {
  assert.equal(rate([], 46), 0);
});

test('started but not marked complete does not count', () => {
  assert.equal(rate([log(45, 'day1', false)], 46), 0);
});

test('the same day logged twice counts once', () => {
  assert.equal(rate([log(45, 'day1'), log(45, 'day1'), log(45, 'day2'), log(45, 'day3'), log(45, 'day4')], 46), 100);
});

test('weeks after the program ends are not counted', () => {
  const all = PROGRAM_WEEKS.flatMap(w => DAYS.map(d => log(w.week, d)));
  assert.equal(rate(all, 53), 100);
});

test('logs outside the program weeks are ignored', () => {
  assert.equal(rate([log(44, 'day1'), log(45, 'day1')], 45), 100);
});

test('a log without week fields is placed by its timestamp', () => {
  const tue3Nov = new Date(2026, 10, 3, 12).getTime();
  const legacy: WorkoutLog = { playerId: 'p1', dayId: 'day1', timestamp: tue3Nov, data: {}, completed: true };
  assert.equal(rate([legacy], 46), 25); // week 45 done 1 of 4, week 46 nothing yet
});
