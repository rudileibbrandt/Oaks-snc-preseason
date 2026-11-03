// What to show after looking up the signed-in user's profile. Pure, tested in profileLoad.test.ts.
// Only a definite "no profile for this sign-in" (db.getOrCreatePlayerForUser throws PROFILE_NOT_FOUND)
// shows the "I am a..." sign-up screen. A slow or failed lookup asks to try again instead, so a
// weak connection never looks like a new user.
import type { Player } from '../types';

export const PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND';

export type ProfileOutcome = 'ready' | 'register' | 'retry';

export const profileOutcome = (result: { player: Player } | { error: unknown }): ProfileOutcome => {
  // A profile found always goes in. (One with no role saved would loop: the sign-up screen finds
  // the same profile and returns it unchanged.)
  if ('player' in result) return 'ready';
  const code = (result.error as { code?: unknown } | null | undefined)?.code;
  return code === PROFILE_NOT_FOUND ? 'register' : 'retry';
};
