export interface ExerciseDef {
  id: string;
  name: string;
  reps: string;
  videoUrl?: string; // Some exercises like A-Skip have no link
  isMetric: boolean; // true if we need to record weight/reps, false if it's just "done"
  isSprint?: boolean; // true if it's a sprint exercise (record sets and time instead of weight)
  group?: string; // Superset letter (A–E) in the Advanced program
  // Non-lift items in the Advanced program, and what the player records for them:
  // cardio = minutes, miles, effort; timed = finish time (min:sec); session = minutes, effort
  logType?: 'cardio' | 'timed' | 'session';
  note?: string; // Coaching note
}

export interface WorkoutDay {
  id: string;
  title: string;
  focus: string;
  exercises: ExerciseDef[];
  date?: string; // ISO date (YYYY-MM-DD), Advanced program only
  note?: string; // Day-level instruction, e.g. "Complete this run if Team Training was not fitness based."
  restNote?: string; // Set on rest days, which have no session to log
}

export type ProgramLevel = 'Intermediate' | 'Advanced';

// One week of the dated Advanced program
export interface AdvancedWeek {
  week: number; // 1–7
  phase: string; // e.g. "Block A", "Deload + test"
  startDate: string; // Monday, ISO date
  days: WorkoutDay[]; // Mon–Sun
}

export interface Player {
  id: string;
  name: string;
  role: 'Player' | 'Coach';
  position?: 'Forward' | 'Back'; // Only for Players - can be set later
  userId?: string; // Firebase auth user ID
  email?: string; // User email from OAuth
  mergedInto?: string; // If set, this account was merged into the referenced Player ID
  program?: ProgramLevel; // S&C program the player chose; missing means Intermediate
  alumniClass?: number; // Graduation year; set means the player is alumni (kept for the records, off current boards)
}

// Per roster player (keyed by normalized name), shared by coaches. Works for players with no app account.
export interface RosterClass {
  gradYear?: number | null; // graduation year; null = coach cleared it; missing = use the roster file
  alumniClass?: number | null; // set = graduated (alumni); null/missing = current player
  squad?: Squad | null; // coach override; null/missing = worked out from the class
}

// High school squads. JV is freshmen and sophomores (u16); everyone else is Varsity.
export type Squad = 'Varsity' | 'JV';

export interface WorkoutLog {
  playerId: string;
  dayId: string;
  timestamp: number;
  weekNumber?: number; // Legacy: old week number (deprecated, use weekYear and week)
  weekYear?: number; // ISO week year (e.g., 2024)
  week?: number; // ISO week number (1-53)
  data: Record<string, string>; // exerciseId -> value (e.g., "100lbs")
  completed: boolean;
  customWorkout?: string; // Optional text description when player did their own workout
}

export type AppView = 'LOGIN' | 'LANDING' | 'COACH' | 'ATHLETE_SELECT' | 'ATHLETE_DASHBOARD' | 'WORKOUT_SESSION' | 'TRACKER' | 'ROSTER' | 'INJURIES' | 'RATING_ANALYTICS' | 'COACHES_CORNER' | 'DEPTH_CHART' | 'STANDARDS' | 'CALENDAR';

// Rugby position numbers (1-15)
export type RugbyPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export const POSITION_NAMES: Record<RugbyPosition, string> = {
  1: 'Loosehead Prop',
  2: 'Hooker',
  3: 'Tighthead Prop',
  4: 'Lock',
  5: 'Lock',
  6: 'Blindside Flanker',
  7: 'Openside Flanker',
  8: 'Number 8',
  9: 'Scrumhalf',
  10: 'Flyhalf',
  11: 'Left Wing',
  12: 'Inside Center',
  13: 'Outside Center',
  14: 'Right Wing',
  15: 'Fullback',
};

export const POSITION_SHORT: Record<RugbyPosition, string> = {
  1: 'LHP', 2: 'HK', 3: 'THP', 4: 'LK', 5: 'LK',
  6: 'BF', 7: 'OF', 8: '#8', 9: 'SH', 10: 'FH',
  11: 'LW', 12: 'IC', 13: 'OC', 14: 'RW', 15: 'FB',
};

// Extended player info for roster display
export interface RosterPlayer {
  name: string;
  trainingGroup: 'Black' | 'Gold' | 'Silver' | 'Bronze';
  height?: string;
  weight?: number;
  email?: string;
  photoUrl?: string;
  grade?: number;
  classYear?: 'Freshman' | 'Sophomore' | 'Junior' | 'Senior';
  kicker?: boolean;
  bestPosition?: RugbyPosition;
  secondPosition?: RugbyPosition;
  thirdPosition?: RugbyPosition;
}

// Injury tracking
export interface InjuryRecord {
  id: string;
  playerName: string;
  coachSubmitting: string;
  grade?: number;
  team: 'Varsity' | 'JV' | 'Academy'; // 'Academy' = older records, shown as JV
  classYear?: 'Freshman' | 'Sophomore' | 'Junior' | 'Senior';
  positions?: string;
  dateOfInjury?: string; // ISO date string or 'TBD'
  daysInjured?: number;
  injuryType: string[]; // e.g., ['Muscle', 'Soft Tissue']
  areaOnBody?: 'Left' | 'Right' | 'Bilateral' | '';
  bodyPart: string[]; // e.g., ['Knee', 'Back']
  diagnosis: string[]; // e.g., ['Strain', 'Sore']
  currentStatus: 'Day to Day' | 'Questionable' | 'IR / Out' | 'Returned to Play';
  returnToPlayDate?: string; // ISO date string
  prognosis?: string;
  returnToPlayPlan?: string;
  estimatedReturnDate?: string;
  notes?: string;
  createdAt?: number; // timestamp when injury was first recorded
  updatedAt: number; // timestamp when injury was last updated
}

// Player skill ratings (360-degree review)
export interface PlayerRatings {
  passCatch: number;          // 1-3
  attackingThreat: number;    // 1-3
  tackleTech: number;         // 1-3
  physicality: number;        // 1-3
  tacticalAwareness: number;  // 1-3
  character: number;          // 1-3
  overallSense: number;       // 1-3
  speedPace: number;          // 1-3
  tacticalKicking: number;    // 1-3
  goalKicking: number;        // 1-3
}

export interface PlayerRating {
  id: string;
  playerName: string;           // RosterPlayer name being rated
  raterId: string;              // Player.id of who rated
  raterUserId?: string;         // Firebase auth UID (for security rules)
  raterName: string;            // Name for display
  ratings: PlayerRatings;
  createdAt: number;            // First rating timestamp
  updatedAt: number;            // Last update timestamp
}

export interface RatingHistoryEntry {
  id: string;
  ratingId: string;             // Links to PlayerRating
  playerName: string;
  raterId: string;
  raterUserId?: string;         // Firebase auth UID
  raterName: string;
  ratings: PlayerRatings;
  timestamp: number;
}

// S&C standards testing. A testing day is a named session; every result belongs to one.
// A player's level is worked out from their results, never stored.
export interface TestSession {
  id: string;
  name: string; // e.g. "Pre-season testing"
  date: string; // YYYY-MM-DD
  time?: string; // start, HH:MM
  createdBy: string;
  createdAt: number;
}

// One player's scores on one testing day, keyed `${sessionId}__${nameKey}`. Stored by roster name,
// so players without an app account can be tested. A missing or null field = not tested.
export interface TestResult {
  id: string;
  sessionId: string;
  nameKey: string; // normalized roster name
  playerName: string;
  group: 'props' | 'hookers' | 'locks' | 'backrow' | 'scrumhalves' | 'flyhalves' | 'centers' | 'backthree';
  bodyweight?: number | null; // lb, on the day (chin-up total = bodyweight + added)
  bronco?: number | null; // seconds
  sprint10?: number | null; // seconds
  sprint40?: number | null; // seconds
  broadJump?: number | null; // inches
  chinupAdded?: number | null; // lb added
  squat3rm?: number | null; // lb
  enteredBy: string;
  updatedAt: number;
}

// Team calendar: practices, matches and other events coaches schedule.
export type TeamEventType = 'Practice' | 'Match' | 'Other';
export interface TeamEvent {
  id: string;
  type: TeamEventType;
  title: string; // e.g. "Practice", "vs Monte Vista"
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  location?: string;
  notes?: string;
  createdBy: string;
  updatedAt: number;
}
