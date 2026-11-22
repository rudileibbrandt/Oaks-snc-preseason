// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pctChange, median, playerImprovement, teamImprovement, sessionPRs, goalProgress, teamTotals,
  type Series,
} from './improvement.ts';

const LOWER = { bronco: true, sprint10: true, squat3rm: false };
const s = (...pts: [string, number][]): Series => pts.map(([date, value]) => ({ date, value }));

test('% change: faster times and bigger numbers are both positive', () => {
  assert.equal(pctChange(400, 380, true), 5);      // Bronco 400 s → 380 s: 5% better
  assert.equal(pctChange(200, 220, false), 10);    // squat 200 → 220 lb: 10% better
  assert.equal(pctChange(2.0, 2.1, true), -5);     // 10 m slower: negative
});

test('median handles odd, even and empty lists', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), undefined);
});

test('a player\'s change is latest vs first; one result gives no change; overall is the average', () => {
  const p = playerImprovement({
    bronco: s(['2026-10-25', 400], ['2026-11-08', 380]),
    squat3rm: s(['2026-10-25', 200], ['2026-11-08', 260], ['2026-12-06', 220]),
    sprint10: s(['2026-11-08', 1.8]),
  }, LOWER);
  assert.equal(p.perTest.bronco, 5);
  assert.equal(p.perTest.squat3rm, 10);          // latest (220), not best (260)
  assert.equal(p.perTest.sprint10, undefined);   // only tested once
  assert.equal(p.overall, 7.5);
});

test('a player with no repeat tests has no overall', () => {
  assert.equal(playerImprovement({ bronco: s(['2026-10-25', 400]) }, LOWER).overall, undefined);
});

test('team improvement is the median player, per test and overall, with counts', () => {
  const players = [
    { perTest: { bronco: 2 }, overall: 2 },
    { perTest: { bronco: 6, squat3rm: 10 }, overall: 8 },
    { perTest: { bronco: 40 }, overall: 40 },     // one big jump doesn't swing the median
    { perTest: {}, overall: undefined },
  ];
  const t = teamImprovement(players, ['bronco', 'squat3rm', 'sprint10']);
  assert.deepEqual(t.perTest.bronco, { median: 6, n: 3 });
  assert.deepEqual(t.perTest.squat3rm, { median: 10, n: 1 });
  assert.equal(t.perTest.sprint10, undefined);
  assert.deepEqual(t.overall, { median: 8, n: 3 });
});

test('PRs on a testing day: better than every earlier result; a first-ever result is not a PR', () => {
  const day = '2026-11-08';
  const r = sessionPRs([
    { name: 'A', series: { bronco: s(['2026-10-25', 400], [day, 390]) } },                       // PR
    { name: 'B', series: { bronco: s(['2026-10-25', 380], [day, 390]) } },                       // slower
    { name: 'C', series: { bronco: s([day, 390]) } },                                            // first test
    { name: 'D', series: { squat3rm: s(['2026-10-25', 200], [day, 200]) } },                     // tie, not a PR
    { name: 'E', series: { bronco: s(['2026-10-25', 400]) } },                                   // not tested that day
  ], day, LOWER);
  assert.deepEqual(r, { prPlayers: ['A'], comparable: 3, prCount: 1 });
});

test('goal (Bronco, lower is better): counted at or under the line, gaps closest first, untested listed', () => {
  const g = goalProgress([
    { name: 'A', best: 370, line: 374 },
    { name: 'B', best: 374, line: 374 },  // exactly on the line counts
    { name: 'C', best: 390, line: 374 },
    { name: 'D', best: 378, line: 374 },
    { name: 'E', best: undefined, line: 374 },
  ], { lowerIsBetter: true, reach: 20 });
  assert.equal(g.counted, 2);
  assert.equal(g.total, 5);
  assert.equal(g.target, 5);              // every player
  assert.deepEqual(g.short.map(x => [x.name, x.gap]), [['D', 4], ['C', 16]]);
  assert.equal(g.withinReach, 2);
  assert.deepEqual(g.notRun, ['E']);
  assert.equal(g.met, false);
});

test('goal (squat, higher is better) with a player count as the target', () => {
  const g = goalProgress([
    { name: 'A', best: 230, line: 225 },
    { name: 'B', best: 215, line: 225 },
    { name: 'C', best: 225, line: 225 },
  ], { lowerIsBetter: false, reach: 15, count: 2 });
  assert.equal(g.counted, 2);
  assert.equal(g.target, 2);
  assert.equal(g.met, true);
  assert.deepEqual(g.short.map(x => [x.name, x.gap]), [['B', 10]]);
});

test('a target count bigger than the squad is capped at the squad', () => {
  assert.equal(goalProgress([{ name: 'A', best: 1, line: 2 }], { lowerIsBetter: true, reach: 1, count: 30 }).target, 1);
});

test('team totals only count players tested twice', () => {
  const t = teamTotals([
    { bronco: s(['2026-10-25', 400], ['2026-11-08', 380]), squat3rm: s(['2026-10-25', 200], ['2026-11-08', 230]) },
    { bronco: s(['2026-10-25', 360], ['2026-11-08', 370]) },
    { bronco: s(['2026-11-08', 350]) },
  ]);
  assert.equal(t.broncoSecondsOff, 10);   // 20 faster, 10 slower
  assert.equal(t.squatLbAdded, 30);
});
