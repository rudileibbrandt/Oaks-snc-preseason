// Run: npm test  (Node's built-in test runner, no extra packages)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LADDERS, rtpState, checkStageMove, stageMoveUpdate, checkInjuryEdit, checkClearance } from './returnToPlay.ts';
import type { InjuryRecord, RtpStageEntry } from '../types.ts';

const TODAY = '2026-11-10';
const inj = (over: Partial<InjuryRecord> = {}): InjuryRecord => ({
  id: 'i1', playerName: 'Kai Stone', coachSubmitting: 'Coach', team: 'Varsity',
  injuryType: ['Muscle'], bodyPart: ['Thigh'], diagnosis: ['Strain'],
  currentStatus: 'IR / Out', updatedAt: 1, ...over,
});
const at = (stage: string, startedOn: string, n = 1): RtpStageEntry => ({ stage, startedOn, by: 'Coach', at: n });
const concussed = (over: Partial<InjuryRecord> = {}) => inj({ bodyPart: ['Head'], diagnosis: ['Concussion'], ...over });
const clearance = { date: '2026-11-08', provider: 'Dr Patel', recordedBy: 'Coach', at: 9 };
const cleared = { clearances: [clearance] };

test('a concussion uses the concussion ladder, anything else the general one', () => {
  assert.equal(rtpState(concussed(), TODAY).ladder, 'concussion');
  assert.equal(rtpState(inj(), TODAY).ladder, 'general');
  assert.equal(LADDERS.concussion.length, 6);
});

test('the current stage is the last entry, with days on it', () => {
  const s = rtpState(inj({ rtpStages: [at('g1', '2026-11-01'), at('g2', '2026-11-07', 2)] }), TODAY);
  assert.equal(s.current?.def.key, 'g2');
  assert.equal(s.current?.index, 1);
  assert.equal(s.current?.daysOn, 3);
  assert.equal(s.next?.key, 'g3');
});

test('an active injury with no stage is flagged', () => {
  assert.deepEqual(rtpState(inj(), TODAY).flags, ['no-stage']);
  assert.deepEqual(rtpState(inj({ currentStatus: 'Returned to Play' }), TODAY).flags, []);
});

test('a concussion with no clearance on file is flagged', () => {
  const s = rtpState(concussed({ rtpStages: [at('c1', '2026-11-09')] }), TODAY);
  assert.deepEqual(s.flags, ['no-clearance']);
  assert.deepEqual(rtpState(concussed({ rtpStages: [at('c1', '2026-11-09')], ...cleared }), TODAY).flags, []);
});

test('a stage from the other ladder counts as no stage (diagnosis changed)', () => {
  const s = rtpState(concussed({ rtpStages: [at('g2', '2026-11-09')] }), TODAY);
  assert.equal(s.current, undefined);
  assert.ok(s.flags.includes('no-stage'));
});

test('players move up one stage at a time, and can always move back', () => {
  const i = inj({ rtpStages: [at('g2', '2026-11-07')] });
  assert.equal(checkStageMove(i, 'g3'), null);
  assert.match(checkStageMove(i, 'g4') ?? '', /one stage at a time/);
  assert.equal(checkStageMove(i, 'g1'), null);
  assert.match(checkStageMove(i, 'g2') ?? '', /already/i);
  assert.match(checkStageMove(i, 'nope') ?? '', /stage/i);
});

test('the first stage set can be any stage but the last, for players already part way through', () => {
  assert.equal(checkStageMove(inj(), 'g3'), null);
  assert.match(checkStageMove(inj(), 'g5') ?? '', /one stage at a time/);
});

test('the newest clearance counts, and older ones are kept', () => {
  const older = { ...clearance, provider: 'Dr Old', at: 1 };
  assert.equal(rtpState(concussed({ clearances: [older, clearance] }), TODAY).clearance?.provider, 'Dr Patel');
});

test('after a concussion, no contact stage without clearance on file', () => {
  const i = concussed({ rtpStages: [at('c4', '2026-11-07')] });
  assert.match(checkStageMove(i, 'c5') ?? '', /clearance/i);
  assert.match(checkStageMove(concussed(), 'c5') ?? '', /clearance/i);
  assert.equal(checkStageMove({ ...i, ...cleared }, 'c5'), null);
});

test('other injuries do not need clearance to move on', () => {
  assert.equal(checkStageMove(inj({ rtpStages: [at('g3', '2026-11-07')] }), 'g4'), null);
});

test('no stage moves once the player has returned to play', () => {
  assert.match(checkStageMove(inj({ currentStatus: 'Returned to Play' }), 'g1') ?? '', /returned/i);
});

test('a stage move is one new history entry', () => {
  const i = inj({ rtpStages: [at('g1', '2026-11-01')] });
  const u = stageMoveUpdate(i, 'g2', 'Sam', TODAY, 42);
  assert.deepEqual(u.entry, { stage: 'g2', startedOn: TODAY, by: 'Sam', at: 42 });
  assert.deepEqual(u.fields, {});
});

test('reaching the last stage marks the player returned to play', () => {
  const u = stageMoveUpdate(inj({ rtpStages: [at('g4', '2026-11-01')] }), 'g5', 'Sam', TODAY, 42);
  assert.deepEqual(u.fields, { currentStatus: 'Returned to Play', returnToPlayDate: TODAY });
});

// The injury form: before = saved record (or undefined for a new report), after = the form.
const form = (diagnosis: string[], currentStatus: InjuryRecord['currentStatus']) => ({ diagnosis, currentStatus });

test('the injury form cannot mark a concussed player returned to play: that goes through the stages', () => {
  assert.match(checkInjuryEdit(undefined, form(['Concussion'], 'Returned to Play')) ?? '', /stages/i);
  assert.match(checkInjuryEdit(concussed(cleared), form(['Concussion'], 'Returned to Play')) ?? '', /stages/i);
  assert.equal(checkInjuryEdit(concussed(), form(['Concussion'], 'Questionable')), null);
  assert.equal(checkInjuryEdit(inj(), form(['Strain'], 'Returned to Play')), null);
  // Already returned (through the stages): editing other details is fine.
  assert.equal(checkInjuryEdit(concussed({ currentStatus: 'Returned to Play' }), form(['Concussion'], 'Returned to Play')), null);
});

test('concussion cannot be removed from an open injury until clearance is on file', () => {
  assert.match(checkInjuryEdit(concussed(), form(['Strain'], 'IR / Out')) ?? '', /concussion/i);
  assert.match(checkInjuryEdit(concussed(), form(['Strain'], 'Returned to Play')) ?? '', /concussion/i);
  assert.equal(checkInjuryEdit(concussed(cleared), form(['Strain'], 'IR / Out')), null);
});

test('a clearance needs who signed it and a date between the injury and today', () => {
  assert.match(checkClearance('', '2026-11-08', TODAY) ?? '', /who signed/i);
  assert.match(checkClearance('Dr Patel', '', TODAY) ?? '', /date/i);
  assert.match(checkClearance('Dr Patel', '2026-11-11', TODAY) ?? '', /future/i);
  assert.match(checkClearance('Dr Patel', '2026-11-01', TODAY, '2026-11-03') ?? '', /before the injury/i);
  assert.equal(checkClearance('Dr Patel', '2026-11-08', TODAY, '2026-11-03'), null);
  assert.equal(checkClearance('Dr Patel', '2026-11-08', TODAY, 'TBD'), null);
});

test('a break, fracture, dislocation or tear also needs clearance before contact', () => {
  for (const d of ['Break', 'Fracture', 'Dislocation', 'Tear']) {
    const i = inj({ diagnosis: [d], rtpStages: [at('g3', '2026-11-07')] });
    assert.equal(rtpState(i, TODAY).ladder, 'general', d);
    assert.deepEqual(rtpState(i, TODAY).flags, ['no-clearance'], d);
    assert.match(checkStageMove(i, 'g4') ?? '', /clearance/i, d);
    assert.equal(checkStageMove({ ...i, ...cleared }, 'g4'), null, d);
  }
});

test('a strain or sprain does not need clearance', () => {
  for (const d of ['Strain', 'Sprain', 'Sore', 'Bruise']) {
    assert.equal(rtpState(inj({ diagnosis: [d] }), TODAY).clearanceRequired, false, d);
  }
});

test('the injury form: a serious injury returns through the stages, and its diagnosis stays until cleared', () => {
  const fracture = inj({ diagnosis: ['Fracture'] });
  assert.match(checkInjuryEdit(fracture, form(['Fracture'], 'Returned to Play')) ?? '', /stages/i);
  assert.match(checkInjuryEdit(fracture, form(['Strain'], 'IR / Out')) ?? '', /fracture/i);
  assert.equal(checkInjuryEdit({ ...fracture, ...cleared }, form(['Strain'], 'IR / Out')), null);
});
