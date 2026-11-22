// When a workout session counts as done. Every completion count in the app uses this.
// Rudi, 22 Nov 2026: writing in "Did My Own Workout" counts, even if the player never taps
// Finish Workout (the box saves on its own when they tap away). No imports, so Node's test runner loads it.
// The "I did my own workout" tick box decides when it's set; older logs (no tick box yet) count by the text.
export const isLogDone = (log: { completed?: boolean; customWorkout?: string; ownWorkout?: boolean } | undefined | null): boolean =>
  !!log && (!!log.completed || (log.ownWorkout ?? !!log.customWorkout?.trim()));
