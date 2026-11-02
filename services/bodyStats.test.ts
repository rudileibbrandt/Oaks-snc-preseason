// Run: npm test  (Node's built-in test runner, no extra packages)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHeight, formatHeight, bodyStatsFor, checkHeight, checkWeight } from './bodyStats.ts';
import type { BodyMeasurement, TestResult, TestSession } from '../types.ts';

const m = (over: Partial<BodyMeasurement>): BodyMeasurement => ({
  id: Math.random().toString(36).slice(2), nameKey: 'kai stone', playerName: 'Kai Stone',
  date: '2026-11-03', enteredBy: 'Kai Stone', enteredByRole: 'Player', createdAt: 1, ...over,
});
const session = (id: string, date: string): TestSession => ({ id, name: 'Testing', date, createdBy: 'Coach', createdAt: 0 });
const result = (sessionId: string, bodyweight: number | null, updatedAt = 5): TestResult => ({
  id: `${sessionId}__kai stone`, sessionId, nameKey: 'kai stone', playerName: 'Kai Stone',
  group: 'props', bodyweight, enteredBy: 'Coach', updatedAt,
});
const roster = { name: 'Kai Stone', trainingGroup: 'Gold' as const, height: "6'3\"", weight: 249 };

test('parseHeight reads the roster format', () => {
  assert.equal(parseHeight("5'9\""), 69);
  assert.equal(parseHeight("6'0\""), 72);
  assert.equal(parseHeight("6'7"), 79);
  assert.equal(parseHeight(undefined), undefined);
  assert.equal(parseHeight('tall'), undefined);
});

test('formatHeight writes feet and inches', () => {
  assert.equal(formatHeight(69), "5'9\"");
  assert.equal(formatHeight(72), "6'0\"");
});

test('no entries: falls back to the roster file, with no history', () => {
  const s = bodyStatsFor({ nameKey: 'kai stone', roster, measurements: [], testResults: [], testSessions: [] });
  assert.equal(s.heightIn, 75);
  assert.equal(s.weightLb, 249);
  assert.equal(s.weightDate, undefined);
  assert.deepEqual(s.weightHistory, []);
});

test('latest entry by date wins, and history is newest first', () => {
  const s = bodyStatsFor({
    nameKey: 'kai stone', roster, testResults: [], testSessions: [],
    measurements: [m({ date: '2026-11-03', weightLb: 245 }), m({ date: '2026-11-10', weightLb: 241 }), m({ date: '2026-11-06', weightLb: 243 })],
  });
  assert.equal(s.weightLb, 241);
  assert.equal(s.weightDate, '2026-11-10');
  assert.deepEqual(s.weightHistory.map(h => h.weightLb), [241, 243, 245]);
});

test('same day: the later entry wins (a correction)', () => {
  const s = bodyStatsFor({
    nameKey: 'kai stone', roster, testResults: [], testSessions: [],
    measurements: [m({ weightLb: 2450, createdAt: 1 }), m({ weightLb: 245, createdAt: 2 })],
  });
  assert.equal(s.weightLb, 245);
});

test('height and weight are tracked separately', () => {
  const s = bodyStatsFor({
    nameKey: 'kai stone', roster, testResults: [], testSessions: [],
    measurements: [m({ date: '2026-11-03', heightIn: 76 }), m({ date: '2026-11-05', weightLb: 240 })],
  });
  assert.equal(s.heightIn, 76);
  assert.equal(s.weightLb, 240);
  assert.equal(s.weightHistory.length, 1);
});

test('a testing-day weigh-in counts, dated by its session', () => {
  const s = bodyStatsFor({
    nameKey: 'kai stone', roster,
    measurements: [m({ date: '2026-11-03', weightLb: 245 })],
    testSessions: [session('t1', '2026-11-08')],
    testResults: [result('t1', 243)],
  });
  assert.equal(s.weightLb, 243);
  assert.equal(s.weightHistory[0].source, 'test');
  assert.equal(s.weightHistory[1].source, 'self');
});

test('test results without a weight, or for an unknown session, are ignored', () => {
  const s = bodyStatsFor({
    nameKey: 'kai stone', roster, measurements: [],
    testSessions: [session('t1', '2026-11-08')],
    testResults: [result('t1', null), result('gone', 230)],
  });
  assert.equal(s.weightLb, 249);
  assert.deepEqual(s.weightHistory, []);
});

test("other players' entries are ignored", () => {
  const s = bodyStatsFor({
    nameKey: 'kai stone', roster, testResults: [], testSessions: [],
    measurements: [m({ nameKey: 'walker french', weightLb: 200 })],
  });
  assert.equal(s.weightLb, 249);
});

test('coach entries are marked as coach', () => {
  const s = bodyStatsFor({
    nameKey: 'kai stone', roster, testResults: [], testSessions: [],
    measurements: [m({ weightLb: 240, enteredByRole: 'Coach', enteredBy: 'Coach Rudi' })],
  });
  assert.equal(s.weightHistory[0].source, 'coach');
});

test('checks reject impossible numbers', () => {
  assert.equal(checkWeight(245), null);
  assert.ok(checkWeight(45));
  assert.ok(checkWeight(2450));
  assert.equal(checkHeight(75), null);
  assert.ok(checkHeight(40));
  assert.ok(checkHeight(100));
});
