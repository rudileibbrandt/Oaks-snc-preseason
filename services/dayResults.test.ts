// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayResults, type DayScores } from './dayResults.ts';

const LOWER = { bronco: true, broadJump: false };
const days: DayScores[] = [
  { sessionId: 'a', date: '2026-10-25', scores: { bronco: 352, broadJump: 88 } },
  { sessionId: 'b', date: '2026-11-08', scores: { bronco: 338 } },
  { sessionId: 'c', date: '2026-11-22', scores: { bronco: 345, broadJump: 91 } },
];

test('first result on a test is marked first, with no change', () => {
  const r = dayResults(days, 'a', LOWER);
  assert.deepEqual(r.bronco, { value: 352, first: true, pr: false, deltaPct: undefined });
});

test('better than every earlier result is a PR, change is vs the previous result', () => {
  const r = dayResults(days, 'b', LOWER);
  assert.equal(r.bronco!.pr, true);
  assert.equal(r.bronco!.deltaPct, 3.98); // 352 → 338 s, faster is +
  assert.equal(r.broadJump, undefined);   // not done that day
});

test('worse than the best so far is not a PR; change compares with the last time it was done', () => {
  const r = dayResults(days, 'c', LOWER);
  assert.equal(r.bronco!.pr, false);
  assert.equal(r.bronco!.deltaPct, -2.07); // 338 → 345 s
  assert.equal(r.broadJump!.pr, true);     // 88 → 91, skipping the day it wasn't done
  assert.equal(r.broadJump!.deltaPct, 3.41);
});

test('days are compared by date, whatever order they come in', () => {
  const r = dayResults([...days].reverse(), 'b', LOWER);
  assert.equal(r.bronco!.pr, true);
});

test('unknown day gives nothing', () => {
  assert.deepEqual(dayResults(days, 'zzz', LOWER), {});
});
