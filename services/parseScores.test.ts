// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBronco, formatBroncoTyping, numbersOnly } from './parseScores.ts';

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

// Phone number pads have no colon (Rudi, 22 Nov 2026): the Bronco box takes digits and puts the colon in.
test('Bronco box auto-formats digits as m:ss while typing', () => {
  assert.equal(formatBroncoTyping('5'), '5');
  assert.equal(formatBroncoTyping('52'), '52');
  assert.equal(formatBroncoTyping('524'), '5:24');
  assert.equal(formatBroncoTyping('1003'), '10:03');
  assert.equal(formatBroncoTyping('10035'), '10:03');
  assert.equal(formatBroncoTyping('5.24'), '5:24');
  assert.equal(formatBroncoTyping('5:2'), '52');
  assert.equal(formatBroncoTyping('5:24'), '5:24');
  assert.equal(parseBronco(formatBroncoTyping('524')), 324);
});

test('number boxes keep only digits and one decimal point', () => {
  assert.equal(numbersOnly('1.82'), '1.82');
  assert.equal(numbersOnly('1,82'), '1.82');
  assert.equal(numbersOnly('94 in'), '94');
  assert.equal(numbersOnly('1.8.2'), '1.82');
  assert.equal(numbersOnly('0'), '0');
});
