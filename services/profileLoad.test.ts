// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileOutcome, PROFILE_NOT_FOUND } from './profileLoad.ts';
import type { Player } from '../types.ts';

const coach: Player = { id: 'p1', name: 'Rudi', role: 'Coach' };
const notFound = Object.assign(new Error('User profile not found. Please complete registration.'), { code: PROFILE_NOT_FOUND });

test('any profile found goes straight in, even one with no role saved', () => {
  assert.equal(profileOutcome({ player: coach }), 'ready');
  // The sign-up screen would find this same profile and loop back to itself.
  assert.equal(profileOutcome({ player: { id: 'p2', name: 'Old', role: undefined as unknown as Player['role'] } }), 'ready');
});

test('only a definite "no profile" sends someone to the sign-up screen', () => {
  assert.equal(profileOutcome({ error: notFound }), 'register');
});

test('a slow or failed lookup asks to try again, never the sign-up screen', () => {
  for (const e of [
    new Error('Profile check timeout after 15 seconds'),
    new Error('Query timeout after 10 seconds'),
    Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' }),
    new Error('Permission denied. Please check Firestore rules.'),
    'something odd',
    undefined,
  ]) {
    assert.equal(profileOutcome({ error: e }), 'retry', String(e));
  }
});

test('an error that only mentions "not found" in its text is not a missing profile', () => {
  assert.equal(profileOutcome({ error: new Error('Document not found') }), 'retry');
});
