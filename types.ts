export interface ExerciseDef {
  id: string;
  name: string;
  reps: string;
  videoUrl?: string; // Some exercises like A-Skip have no link
  isMetric: boolean; // true if we need to record weight/reps, false if it's just "done"
  isSprint?: boolean; // true if it's a sprint exercise (record sets and time instead of weight)
}

export interface WorkoutDay {
  id: string;
  title: string;
  focus: string;
  exercises: ExerciseDef[];
}

export interface Player {
  id: string;
  name: string;
  role: 'Player' | 'Coach';
  position?: 'Forward' | 'Back'; // Only for Players - can be set later
  userId?: string; // Firebase auth user ID
  email?: string; // User email from OAuth
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

export type AppView = 'LOGIN' | 'LANDING' | 'COACH' | 'ATHLETE_SELECT' | 'ATHLETE_DASHBOARD' | 'WORKOUT_SESSION' | 'TRACKER';
