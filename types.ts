export interface ExerciseDef {
  id: string;
  name: string;
  reps: string;
  videoUrl?: string; // Some exercises like A-Skip have no link
  isMetric: boolean; // true if we need to record weight/reps, false if it's just "done"
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
  position: 'Forward' | 'Back';
}

export interface WorkoutLog {
  playerId: string;
  dayId: string;
  timestamp: number;
  data: Record<string, string>; // exerciseId -> value (e.g., "100kg")
  completed: boolean;
}

export type AppView = 'LANDING' | 'COACH' | 'ATHLETE_SELECT' | 'ATHLETE_DASHBOARD' | 'WORKOUT_SESSION';
