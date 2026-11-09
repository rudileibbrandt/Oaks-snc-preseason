// A player's positions, one shared answer for every screen. Saved in the app (rosterClasses) by a
// coach or the player; otherwise the team list file. A coach's setting can't be changed by a
// player. Only type imports, so the tests can load it.
import type { RugbyPosition } from '../types';

export type PositionsBy = 'coach' | 'player';

export interface Positions {
  best?: RugbyPosition;
  second?: RugbyPosition;
  third?: RugbyPosition;
  source: PositionsBy | 'list' | 'none';
}

// 1-15 only, no repeats, at most three, in the order given.
export const cleanPositions = (list: readonly number[] | undefined | null): RugbyPosition[] =>
  [...new Set((list ?? []).filter(n => Number.isInteger(n) && n >= 1 && n <= 15))].slice(0, 3) as RugbyPosition[];

export const effectivePositions = (
  listed: { bestPosition?: RugbyPosition; secondPosition?: RugbyPosition; thirdPosition?: RugbyPosition },
  saved: { positions?: readonly number[] | null; positionsBy?: PositionsBy } | undefined,
): Positions => {
  if (saved?.positions) {
    const [best, second, third] = cleanPositions(saved.positions);
    return { best, second, third, source: saved.positionsBy ?? 'coach' };
  }
  const { bestPosition: best, secondPosition: second, thirdPosition: third } = listed;
  return { best, second, third, source: best || second || third ? 'list' : 'none' };
};

// Coach wins: a player can't overwrite positions a coach set.
export const canSetPositions = (who: PositionsBy, current: PositionsBy | undefined) =>
  who === 'coach' || current !== 'coach';

// A player picks their main position; their other positions stay, behind it.
export const withBest = (best: RugbyPosition, current: readonly number[]): RugbyPosition[] =>
  cleanPositions([best, ...current]);

export const positionList = (p: Positions): RugbyPosition[] =>
  [p.best, p.second, p.third].filter((x): x is RugbyPosition => !!x);
