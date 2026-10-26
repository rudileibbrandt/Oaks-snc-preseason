// Graduation years for roster players.
//
// We store the graduation year, never "Senior": the label is derived, so it rolls over each
// school year without anyone re-marking players.
import { InjuryRecord, Player, PlayerRating, RosterClass, RosterPlayer, Squad } from '../types';
import { db } from './db';
import { isAlumni, normalizeName } from './alumni';

// The class that graduates at the end of the current school year (Aug–Jul).
// Oct 2026 → 2027; May 2027 → 2027; Aug 2027 → 2028.
export const seniorClassYear = (now = new Date()) =>
  now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();

// The four classes in school right now, seniors first: Oct 2026 → [2027, 2028, 2029, 2030].
export const currentClassYears = (now = new Date()) => {
  const senior = seniorClassYear(now);
  return [senior, senior + 1, senior + 2, senior + 3];
};

// "Senior", "Junior", ... for a graduation year this school year; undefined if outside high school.
export const classStanding = (gradYear: number, now = new Date()) =>
  (['Senior', 'Junior', 'Sophomore', 'Freshman'] as const)[gradYear - seniorClassYear(now)];

// "Class of 2027 · Senior"
export const classLabel = (gradYear: number, now = new Date()) => {
  const standing = classStanding(gradYear, now);
  return `Class of ${gradYear}${standing ? ` · ${standing}` : ''}`;
};

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
export const gradYearOf = (rp: RosterPlayer, classes: Record<string, RosterClass>): number | undefined => {
  const entry = classes[classKey(rp.name)];
  if (entry && 'gradYear' in entry) return entry.gradYear ?? undefined;
  return fileGradYear(rp);
};

// ---------- Squads ----------
//
// JV is freshmen and sophomores (u16); juniors and seniors are Varsity. Worked out from the class,
// so it rolls over each year. A coach can override any player. No class yet = Varsity, flagged.

export const SQUADS: Squad[] = ['Varsity', 'JV'];

export interface SquadInfo {
  squad: Squad;
  source: 'coach' | 'class' | 'unset'; // unset = no class yet, counted as Varsity
}

export const squadFromClass = (gradYear: number, now = new Date()): Squad =>
  gradYear >= seniorClassYear(now) + 2 ? 'JV' : 'Varsity';

export const squadOf = (rp: RosterPlayer, classes: Record<string, RosterClass>, now = new Date()): SquadInfo => {
  const override = classes[classKey(rp.name)]?.squad;
  if (override) return { squad: override, source: 'coach' };
  const gradYear = gradYearOf(rp, classes);
  if (gradYear === undefined) return { squad: 'Varsity', source: 'unset' };
  return { squad: squadFromClass(gradYear, now), source: 'class' };
};

// "Varsity", "JV · set by coach", "Varsity · class not set"
export const squadLabel = (info: SquadInfo) =>
  info.source === 'coach' ? `${info.squad} · set by coach` : info.source === 'unset' ? `${info.squad} · class not set` : info.squad;

// Older injury records say "Academy", which is now JV.
export const injurySquad = (team: InjuryRecord['team']): Squad => (team === 'Varsity' ? 'Varsity' : 'JV');

// ---------- Alumni for roster players (with or without an app account) ----------
//
// Alumni status is kept in two places: on the app account (the Stat Board and Tracker read that)
// and on the roster entry by name (the depth chart and roster panels read that, and it covers
// players who never made an account). setRosterAlumni writes both.

export const alumniClassOf = (name: string, classes: Record<string, RosterClass>, account?: Player): number | undefined =>
  (account && isAlumni(account) ? account.alumniClass : undefined) ?? classes[classKey(name)]?.alumniClass ?? undefined;

// Normalized names of everyone who has graduated, from either source.
export const rosterAlumniNames = (players: Player[], classes: Record<string, RosterClass>) => {
  const names = new Set(players.filter(isAlumni).map(p => normalizeName(p.name)));
  for (const [key, entry] of Object.entries(classes)) if (entry.alumniClass) names.add(key);
  return names;
};

// Move a roster player to alumni (year) or back to the current team (null).
export const setRosterAlumni = async (name: string, account: Player | undefined, year: number | null) => {
  try {
    if (account) await db.setPlayerAlumni(account.id, year);
    await db.setRosterClass(classKey(name), name, { alumniClass: year });
  } finally {
    invalidateAlumniNames();
  }
};

// ---------- Shared, cached roster lookup (alumni and squads) ----------

export interface RosterContext {
  classes: Record<string, RosterClass>;
  alumniNames: Set<string>;
}

let rosterContextCache: Promise<RosterContext> | null = null;

// Loaded once and shared by every screen; a failed load means "nothing known" rather than an error.
export const loadRosterContext = (): Promise<RosterContext> => {
  if (!rosterContextCache) {
    rosterContextCache = Promise.all([
      db.getPlayers().catch(() => [] as Player[]),
      db.getRosterClasses().catch(() => ({} as Record<string, RosterClass>)),
    ]).then(([players, classes]) => ({ classes, alumniNames: rosterAlumniNames(players, classes) }));
  }
  return rosterContextCache;
};

export const loadAlumniNames = () => loadRosterContext().then(c => c.alumniNames);

// Call after any change to classes, squads or alumni.
export const invalidateRosterContext = () => { rosterContextCache = null; };
export const invalidateAlumniNames = invalidateRosterContext;

// Ratings that still count: neither the player rated nor the rater has graduated.
// keepName (the viewer) is always kept, so an alumnus can still see their own feedback.
export const currentRatingsOnly = (ratings: PlayerRating[], alumniNames: Set<string>, keepName?: string) => {
  const keep = keepName ? normalizeName(keepName) : null;
  return ratings.filter(r => {
    const player = normalizeName(r.playerName);
    if (player === keep) return true;
    return !alumniNames.has(player) && !alumniNames.has(normalizeName(r.raterName || ''));
  });
};

// Thrown when someone tries to score a graduated player.
export class AlumniError extends Error {
  constructor(name: string) {
    super(`${name} has graduated (Alumni), so they can't be scored. Restore them in Graduate Seniors first.`);
    this.name = 'AlumniError';
  }
}

// Guard for every write that scores a player. Reads fresh data, so a graduation made on
// another device counts too.
export const assertNotAlumni = async (playerName: string) => {
  invalidateAlumniNames();
  const names = await loadAlumniNames();
  if (names.has(normalizeName(playerName))) throw new AlumniError(playerName);
};
