// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectivePositions, canSetPositions, cleanPositions, withBest } from './positions.ts';

const listed = { bestPosition: 9 as const, secondPosition: 10 as const };

test('nothing saved in the app: the team list positions', () => {
  assert.deepEqual(effectivePositions(listed, undefined), { best: 9, second: 10, third: undefined, source: 'list' });
});

test('saved in the app (by a coach or the player) wins over the team list', () => {
  assert.deepEqual(effectivePositions(listed, { positions: [6, 7], positionsBy: 'coach' }), { best: 6, second: 7, third: undefined, source: 'coach' });
  assert.deepEqual(effectivePositions(listed, { positions: [12], positionsBy: 'player' }), { best: 12, second: undefined, third: undefined, source: 'player' });
});

test('cleared in the app (empty list) means no position, not the team list', () => {
  assert.deepEqual(effectivePositions(listed, { positions: [], positionsBy: 'coach' }), { best: undefined, second: undefined, third: undefined, source: 'coach' });
});

test('no position anywhere', () => {
  assert.equal(effectivePositions({}, undefined).source, 'none');
});

test("a player can't change positions a coach set; a coach can change anything", () => {
  assert.equal(canSetPositions('player', 'coach'), false);
  assert.equal(canSetPositions('player', 'player'), true);
  assert.equal(canSetPositions('player', undefined), true);
  assert.equal(canSetPositions('coach', 'coach'), true);
  assert.equal(canSetPositions('coach', 'player'), true);
});

test('positions are cleaned: 1-15 only, no repeats, at most three, order kept', () => {
  assert.deepEqual(cleanPositions([6, 6, 0, 16, 7, 8, 9] as any), [6, 7, 8]);
  assert.deepEqual(cleanPositions(undefined), []);
});

test('a player picking a main position keeps their others behind it', () => {
  assert.deepEqual(withBest(7, [6, 7, 8]), [7, 6, 8]);
  assert.deepEqual(withBest(12, [6, 7, 8]), [12, 6, 7]);
});
