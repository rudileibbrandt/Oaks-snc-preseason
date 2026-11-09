import { RugbyPosition, POSITION_NAMES, POSITION_SHORT } from '../types';

const POSITIONS_KEY = 'oaks_positions_v1';

export interface PlayerPositions {
  bestPosition?: RugbyPosition;
  secondPosition?: RugbyPosition;
  thirdPosition?: RugbyPosition;
}

// Position edits used to be saved only in the editing coach's browser (this key). They now live
// in the app (rosterClasses.positions). This hands any left in this browser to `save` once, then
// clears them. Returns how many were handed over.
export async function takeBrowserPositionEdits(save: (name: string, edit: PlayerPositions) => Promise<void>): Promise<number> {
  let edits: Record<string, PlayerPositions> = {};
  try { edits = JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}'); } catch { /* unreadable: nothing to move */ }
  const entries = Object.entries(edits);
  for (const [name, p] of entries) {
    await save(name, p);
  }
  try { localStorage.removeItem(POSITIONS_KEY); } catch { /* storage blocked */ }
  return entries.length;
}

// Position options for dropdowns
export const POSITION_OPTIONS: { value: RugbyPosition; label: string; short: string }[] = [
  { value: 1, label: 'Loosehead Prop', short: '1 - LHP' },
  { value: 2, label: 'Hooker', short: '2 - HK' },
  { value: 3, label: 'Tighthead Prop', short: '3 - THP' },
  { value: 4, label: 'Lock', short: '4 - LK' },
  { value: 5, label: 'Lock', short: '5 - LK' },
  { value: 6, label: 'Blindside Flanker', short: '6 - BF' },
  { value: 7, label: 'Openside Flanker', short: '7 - OF' },
  { value: 8, label: 'Number 8', short: '8 - #8' },
  { value: 9, label: 'Scrumhalf', short: '9 - SH' },
  { value: 10, label: 'Flyhalf', short: '10 - FH' },
  { value: 11, label: 'Left Wing', short: '11 - LW' },
  { value: 12, label: 'Inside Center', short: '12 - IC' },
  { value: 13, label: 'Outside Center', short: '13 - OC' },
  { value: 14, label: 'Right Wing', short: '14 - RW' },
  { value: 15, label: 'Fullback', short: '15 - FB' },
];

export function formatPosition(pos?: RugbyPosition): string {
  if (!pos) return '—';
  return `${pos} - ${POSITION_SHORT[pos]}`;
}

export function formatPositionLong(pos?: RugbyPosition): string {
  if (!pos) return 'Not set';
  return `${pos}. ${POSITION_NAMES[pos]}`;
}
