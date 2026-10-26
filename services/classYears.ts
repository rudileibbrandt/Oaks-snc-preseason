// Graduation years for roster players.
//
// We store the graduation year, never "Senior": the label is derived, so it rolls over each
// school year without anyone re-marking players.
import { RosterPlayer } from '../types';
import { normalizeName } from './alumni';

// The class that graduates at the end of the current school year (Aug–Jul).
// Oct 2026 → 2027; May 2027 → 2027; Aug 2027 → 2028.
export const seniorClassYear = (now = new Date()) =>
  now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();

// The roster file was written for the 2026 season (the 2025–26 school year), so a "Senior" there
// is Class of 2026, a grade 11 is Class of 2027, and so on.
const FILE_SEASON_CLASS = 2026;
const YEARS_LEFT: Record<NonNullable<RosterPlayer['classYear']>, number> = {
  Senior: 0, Junior: 1, Sophomore: 2, Freshman: 3,
};
const fileGradYear = (rp: RosterPlayer): number | undefined => {
  if (rp.grade) return FILE_SEASON_CLASS + (12 - rp.grade);
  if (rp.classYear) return FILE_SEASON_CLASS + YEARS_LEFT[rp.classYear];
  return undefined;
};

export const classKey = (name: string) => normalizeName(name);

// Stored year wins (null = coach cleared it); otherwise fall back to the roster file.
export const gradYearOf = (rp: RosterPlayer, stored: Record<string, number | null>): number | undefined => {
  const key = classKey(rp.name);
  if (key in stored) return stored[key] ?? undefined;
  return fileGradYear(rp);
};
