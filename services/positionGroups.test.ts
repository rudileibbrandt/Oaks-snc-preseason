// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testingGroup, groupForPosition } from './positionGroups.ts';

test('a known position gives its group', () => {
  assert.equal(testingGroup(1), 'props');
  assert.equal(testingGroup(14), 'backthree');
});

// Rudi, 8 Nov 2026: players whose position is blank or not sure are tested as back rowers.
test('no position: tested as back row', () => {
  assert.equal(testingGroup(undefined), 'backrow');
});

test('groupForPosition still says "unknown" for no position (depth charts etc.)', () => {
  assert.equal(groupForPosition(undefined), undefined);
});

import { playerGroup } from './positionGroups.ts';
const sessions = [{ id: 'a', date: '2026-10-25' }, { id: 'b', date: '2026-11-08' }] as any;
const results = [{ sessionId: 'a', group: 'props' }, { sessionId: 'b', group: 'locks' }] as any;

test("the player's current position decides the group, so a change shows everywhere at once", () => {
  assert.equal(playerGroup(results, sessions, 14), 'backthree');
});

test('no position: the latest result group, else back row', () => {
  assert.equal(playerGroup(results, sessions, undefined), 'locks');
  assert.equal(playerGroup([], sessions, undefined), 'backrow');
});
