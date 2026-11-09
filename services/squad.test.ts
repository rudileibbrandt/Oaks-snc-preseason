// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSquad } from './squad.ts';

test("a coach's override wins over SportsEngine and the class", () => {
  assert.deepEqual(pickSquad({ override: 'Varsity', sportsEngine: 'JV', fromClass: 'JV' }), { squad: 'Varsity', source: 'coach' });
});

test('SportsEngine wins over the class year', () => {
  assert.deepEqual(pickSquad({ sportsEngine: 'JV', fromClass: 'Varsity' }), { squad: 'JV', source: 'sportsengine' });
  assert.deepEqual(pickSquad({ sportsEngine: 'Varsity' }), { squad: 'Varsity', source: 'sportsengine' });
});

test('no override and not on SportsEngine: the class decides, else Varsity flagged as unset', () => {
  assert.deepEqual(pickSquad({ fromClass: 'JV' }), { squad: 'JV', source: 'class' });
  assert.deepEqual(pickSquad({}), { squad: 'Varsity', source: 'unset' });
});
