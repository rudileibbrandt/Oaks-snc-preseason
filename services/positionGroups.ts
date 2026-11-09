// Position groups for testing standards. Only a type import, so the tests can load it.
import type { RugbyPosition } from '../types';

export type PositionGroup = 'props' | 'hookers' | 'locks' | 'backrow' | 'scrumhalves' | 'flyhalves' | 'centers' | 'backthree';

export const GROUPS: { key: PositionGroup; label: string; positions: RugbyPosition[] }[] = [
  { key: 'props', label: 'Props · 1 and 3', positions: [1, 3] },
  { key: 'hookers', label: 'Hookers · 2', positions: [2] },
  { key: 'locks', label: 'Locks · 4 and 5', positions: [4, 5] },
  { key: 'backrow', label: 'Back row · 6, 7 and 8', positions: [6, 7, 8] },
  { key: 'scrumhalves', label: 'Scrumhalves · 9', positions: [9] },
  { key: 'flyhalves', label: 'Flyhalves · 10', positions: [10] },
  { key: 'centers', label: 'Centers · 12 and 13', positions: [12, 13] },
  { key: 'backthree', label: 'Back three · 11, 14 and 15', positions: [11, 14, 15] },
];

export const groupLabel = (g: PositionGroup) => GROUPS.find(x => x.key === g)?.label ?? g;
export const groupForPosition = (pos?: RugbyPosition): PositionGroup | undefined =>
  pos ? GROUPS.find(g => g.positions.includes(pos))?.key : undefined;

// Players whose position is blank or not sure are tested as back rowers (Rudi, 8 Nov 2026).
export const DEFAULT_GROUP: PositionGroup = 'backrow';
export const testingGroup = (pos?: RugbyPosition): PositionGroup => groupForPosition(pos) ?? DEFAULT_GROUP;
