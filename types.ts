export interface ExerciseDef {
  id: string;
  name: string;
  reps: string;
  videoUrl?: string; // Some exercises like A-Skip have no link
  isMetric: boolean; // true if we need to record weight/reps, false if it's just "done"
  isSprint?: boolean; // true if it's a sprint exercise (record sets and time instead of weight)
  group?: string; // Superset letter (A–E) in the Advanced program
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
}

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

export type AppView = 'LOGIN' | 'LANDING' | 'COACH' | 'ATHLETE_SELECT' | 'ATHLETE_DASHBOARD' | 'WORKOUT_SESSION' | 'TRACKER' | 'ROSTER' | 'INJURIES' | 'RATING_ANALYTICS' | 'COACHES_CORNER' | 'DEPTH_CHART';

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
  squad: '1sts and 2nds' | 'Academy';
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
  team: 'Varsity' | 'Academy';
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
