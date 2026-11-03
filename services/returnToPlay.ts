// Return-to-play stages for an injury. Pure functions only, tested in services/returnToPlay.test.ts.
// Every stage move and every clearance is kept on the injury (rtpStages, clearances); the current
// stage and the clearance that counts are the newest entries, worked out, never stored on their own.
// The app records the protocol; medical staff and coaches decide when a player moves on.
import type { InjuryRecord, RtpClearance, RtpStageEntry } from '../types';

export type Ladder = 'concussion' | 'general';

export interface RtpStageDef {
  key: string;
  name: string;
  detail: string;
  contact: boolean; // contact stages need clearance on file when the injury needs it
}

export const LADDERS: Record<Ladder, RtpStageDef[]> = {
  // World Rugby's graduated return to play after concussion.
  concussion: [
    { key: 'c1', name: 'Symptom-limited activity', detail: 'Daily activities that don\'t bring on symptoms', contact: false },
    { key: 'c2', name: 'Light aerobic exercise', detail: 'Walking, swimming or a stationary bike; no resistance training', contact: false },
    { key: 'c3', name: 'Sport-specific exercise', detail: 'Running drills; no head impact', contact: false },
    { key: 'c4', name: 'Non-contact training drills', detail: 'Harder drills such as passing; may start light resistance training', contact: false },
    { key: 'c5', name: 'Full contact practice', detail: 'Normal training, only after medical clearance', contact: true },
    { key: 'c6', name: 'Return to play', detail: 'Cleared for games', contact: true },
  ],
  general: [
    { key: 'g1', name: 'Rest and rehab', detail: 'Treatment and rehab exercises only', contact: false },
    { key: 'g2', name: 'Light conditioning', detail: 'Light running or bike, pain-free', contact: false },
    { key: 'g3', name: 'Non-contact training', detail: 'Joins training drills without contact', contact: false },
    { key: 'g4', name: 'Full contact training', detail: 'Normal training with contact', contact: true },
    { key: 'g5', name: 'Return to play', detail: 'Cleared for games', contact: true },
  ],
};

export type RtpFlag = 'no-stage' | 'no-clearance';

export interface RtpState {
  ladder: Ladder;
  stages: RtpStageDef[];
  concussion: boolean;
  clearanceRequired: boolean; // a concussion or another serious injury: no contact without clearance on file
  active: boolean; // not yet returned to play
  current?: { index: number; def: RtpStageDef; startedOn: string; daysOn: number };
  next?: RtpStageDef;
  clearance?: RtpClearance; // the newest
  flags: RtpFlag[];
}

// Local date as YYYY-MM-DD (not UTC, so an evening entry isn't dated tomorrow).
export const todayIso = () => new Date().toLocaleDateString('en-CA');

const isConcussion = (diagnosis?: string[]) => (diagnosis ?? []).includes('Concussion');

// Diagnoses that need a written medical clearance before contact (coaching team, 2026-11-02).
export const CLEARANCE_DIAGNOSES = ['Concussion', 'Break', 'Fracture', 'Dislocation', 'Tear'];
const clearanceDiagnoses = (diagnosis?: string[]) => (diagnosis ?? []).filter(d => CLEARANCE_DIAGNOSES.includes(d));
const latestClearance = (injury: Pick<InjuryRecord, 'clearances'>) => injury.clearances?.[injury.clearances.length - 1];

// Whole days between two YYYY-MM-DD dates.
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

// The one clearance rule: for a concussion or other serious injury, contact stages need a clearance on file.
export const needsClearance = (state: RtpState, stage: RtpStageDef) => state.clearanceRequired && stage.contact && !state.clearance;

export const rtpState = (injury: InjuryRecord, today = todayIso()): RtpState => {
  const concussion = isConcussion(injury.diagnosis);
  const clearanceRequired = clearanceDiagnoses(injury.diagnosis).length > 0;
  const ladder: Ladder = concussion ? 'concussion' : 'general';
  const stages = LADDERS[ladder];
  const active = injury.currentStatus !== 'Returned to Play';
  const clearance = latestClearance(injury);

  // A stage from the other ladder (the diagnosis changed since) doesn't count.
  const last = injury.rtpStages?.[injury.rtpStages.length - 1];
  const index = last ? stages.findIndex(s => s.key === last.stage) : -1;
  const current = last && index >= 0
    ? { index, def: stages[index], startedOn: last.startedOn, daysOn: Math.max(0, daysBetween(last.startedOn, today)) }
    : undefined;

  const flags: RtpFlag[] = [];
  if (active && !current) flags.push('no-stage');
  if (active && clearanceRequired && !clearance) flags.push('no-clearance');

  return { ladder, stages, concussion, clearanceRequired, active, current, clearance, flags, next: current ? stages[current.index + 1] : undefined };
};

// Counts for the injury list's header.
export const rtpGaps = (injuries: InjuryRecord[], today = todayIso()) => {
  const states = injuries.map(i => rtpState(i, today));
  return {
    noStage: states.filter(s => s.flags.includes('no-stage')).length,
    noClearance: states.filter(s => s.flags.includes('no-clearance')).length,
  };
};

// Error text, or null if the player can move to this stage.
export const checkStageMove = (injury: InjuryRecord, toKey: string): string | null => {
  const state = rtpState(injury);
  if (!state.active) return 'This player has returned to play.';
  const to = state.stages.findIndex(s => s.key === toKey);
  if (to < 0) return 'Unknown stage for this injury.';
  if (state.current) {
    if (to === state.current.index) return 'The player is already on this stage.';
    if (to > state.current.index + 1) return 'Players move up one stage at a time.';
  } else if (to === state.stages.length - 1) {
    // The first stage set can be where the player is now, but not straight back to games.
    return 'Players move up one stage at a time. Set the stage they are on now.';
  }
  if (needsClearance(state, state.stages[to])) {
    return 'Record the written medical clearance before any contact for this injury.';
  }
  return null;
};

// What to save for a stage move (check it with checkStageMove first): one new history entry, plus
// the return-to-play fields when it's the last stage.
export const stageMoveUpdate = (
  injury: InjuryRecord, toKey: string, by: string, today: string, now: number,
): { entry: RtpStageEntry; fields: Partial<InjuryRecord> } => {
  const { stages } = rtpState(injury, today);
  const isLast = stages[stages.length - 1].key === toKey;
  return {
    entry: { stage: toKey, startedOn: today, by, at: now },
    fields: isLast ? { currentStatus: 'Returned to Play', returnToPlayDate: today } : {},
  };
};

// For the injury form. before = the saved injury (undefined for a new report).
export const checkInjuryEdit = (
  before: InjuryRecord | undefined,
  after: { diagnosis: string[]; currentStatus: InjuryRecord['currentStatus'] },
): string | null => {
  const stillOpen = before ? before.currentStatus !== 'Returned to Play' : true;
  const cleared = !!(before && latestClearance(before));
  const removed = clearanceDiagnoses(before?.diagnosis).filter(d => !after.diagnosis.includes(d));
  if (stillOpen && !cleared && removed.length > 0) {
    return `${removed.join(' and ')} can't be removed from an open injury until a medical clearance is on file.`;
  }
  if (clearanceDiagnoses(after.diagnosis).length > 0 && after.currentStatus === 'Returned to Play' && stillOpen) {
    return 'A player with this injury returns to play through the return-to-play stages, not this form.';
  }
  return null;
};

export const checkClearance = (provider: string, date: string, today: string, dateOfInjury?: string): string | null => {
  if (!provider.trim()) return 'Enter who signed the clearance.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Enter the date on the clearance.';
  if (date > today) return 'The clearance date can\'t be in the future.';
  if (dateOfInjury && /^\d{4}-\d{2}-\d{2}$/.test(dateOfInjury) && date < dateOfInjury) {
    return 'The clearance date can\'t be before the injury.';
  }
  return null;
};
