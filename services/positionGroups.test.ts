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
