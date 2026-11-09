// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBronco } from './parseScores.ts';

test('Bronco in m:ss is read as minutes and seconds', () => {
  assert.equal(parseBronco('5:05'), 305);
  assert.equal(parseBronco(' 6:13 '), 373);
});

test('Bronco as plain seconds still works', () => {
  assert.equal(parseBronco('305'), 305);
});

// Chris typed "5.05" on 1 Nov 2026 and it was saved as 5 seconds, which then showed as his best.
test('an impossible Bronco (under 3 minutes) is refused, not saved as seconds', () => {
  assert.equal(parseBronco('5.05'), undefined);
  assert.equal(parseBronco('5'), undefined);
  assert.equal(parseBronco('0:05'), undefined);
  assert.equal(parseBronco('2:59'), undefined);
  assert.equal(parseBronco('3:00'), 180);
});

test('an impossible Bronco (over 15 minutes) is refused', () => {
  assert.equal(parseBronco('15:01'), undefined);
  assert.equal(parseBronco('15:00'), 900);
});
