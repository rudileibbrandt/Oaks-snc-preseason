// Which squad (Varsity or JV) a player is in. No imports beyond types, so the tests can load it.
import type { Squad } from '../types';

export interface SquadInfo {
  squad: Squad;
  // coach = set in the app; sportsengine = the team's SportsEngine roster (team list file);
  // class = worked out from the class year; unset = none of these, counted as Varsity.
  source: 'coach' | 'sportsengine' | 'class' | 'unset';
}

export const pickSquad = (p: { override?: Squad | null; sportsEngine?: Squad; fromClass?: Squad }): SquadInfo =>
  p.override ? { squad: p.override, source: 'coach' }
  : p.sportsEngine ? { squad: p.sportsEngine, source: 'sportsengine' }
  : p.fromClass ? { squad: p.fromClass, source: 'class' }
  : { squad: 'Varsity', source: 'unset' };
