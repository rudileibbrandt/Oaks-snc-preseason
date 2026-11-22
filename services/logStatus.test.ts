// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLogDone } from './logStatus.ts';

// Rudi, 22 Nov 2026: "Did my own workout" counts as a completed session, even without Finish Workout.
test('a session is done when finished, or when the player wrote their own workout', () => {
  assert.equal(isLogDone({ completed: true }), true);
  assert.equal(isLogDone({ completed: false, customWorkout: 'Ran 3 miles, push-ups' }), true);
  assert.equal(isLogDone({ completed: false }), false);
  assert.equal(isLogDone({ completed: false, customWorkout: '   ' }), false);
  assert.equal(isLogDone(undefined), false);
});

test('the "I did my own workout" tick box counts on its own, and unticking it stops the text counting', () => {
  assert.equal(isLogDone({ completed: false, ownWorkout: true }), true);
  assert.equal(isLogDone({ completed: false, ownWorkout: false, customWorkout: 'Ran 3 miles' }), false);
  assert.equal(isLogDone({ completed: true, ownWorkout: false }), true); // Finish Workout still counts
});
