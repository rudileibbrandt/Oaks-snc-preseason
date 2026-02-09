import { PlayerRating, RatingHistoryEntry, PlayerRatings } from '../types';
import { db } from './db';

// Rating skill definitions
export interface RatingSkill {
  key: keyof PlayerRatings;
  label: string;
  shortLabel: string;
  description: string;
}

export const RATING_SKILLS: RatingSkill[] = [
  {
    key: 'passCatch',
    label: 'Pass/Catch',
    shortLabel: 'Pass',
    description: 'Ball handling and receiving ability',
  },
  {
    key: 'attackingThreat',
    label: 'Attacking Threat',
    shortLabel: 'Atk',
    description: 'Offensive impact and scoring potential',
  },
  {
    key: 'tackleTech',
    label: 'Tackle Tech',
    shortLabel: 'Tck',
    description: 'Tackling technique and execution',
  },
  {
    key: 'physicality',
    label: 'Physicality',
    shortLabel: 'Phy',
    description: 'Physical presence and contact ability',
  },
  {
    key: 'tacticalAwareness',
    label: 'Tactical Awareness',
    shortLabel: 'Tac',
    description: 'Game sense and decision making',
  },
  {
    key: 'character',
    label: 'Character',
    shortLabel: 'Chr',
    description: 'Attitude, work ethic, coachability',
  },
  {
    key: 'overallSense',
    label: 'Overall Sense',
    shortLabel: 'Ovr',
    description: 'General rugby IQ and instincts',
  },
  {
    key: 'speedPace',
    label: 'Speed/Pace',
    shortLabel: 'Spd',
    description: 'Raw speed and acceleration',
  },
  {
    key: 'tacticalKicking',
    label: 'Tactical Kicking',
    shortLabel: 'TKk',
    description: 'Kicking in open play, territory management',
  },
  {
    key: 'goalKicking',
    label: 'Goal Kicking',
    shortLabel: 'GKk',
    description: 'Conversions and penalty kicks',
  },
];

// Rating scale labels
export const RATING_LABELS: Record<number, string> = {
  1: 'Novice',
  2: 'Developing',
  3: 'Competent',
  4: 'Proficient',
  5: 'Outstanding',
};

// Rating scale colors
export const RATING_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  2: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  3: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  4: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  5: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
};

// Cache for ratings
let ratingsCache: PlayerRating[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 30000; // 30 seconds

// Invalidate cache (call after save operations)
export function invalidateRatingsCache(): void {
  ratingsCache = null;
  cacheTimestamp = 0;
}

// Load all ratings with caching
export async function loadRatings(): Promise<PlayerRating[]> {
  const now = Date.now();
  if (ratingsCache && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[ratingData] Returning cached ratings:', ratingsCache.length);
    return ratingsCache;
  }

  try {
    console.log('[ratingData] Loading ratings from database...');
    ratingsCache = await db.getRatings();
    cacheTimestamp = now;
    return ratingsCache;
  } catch (error) {
    console.error('[ratingData] Failed to load ratings:', error);
    return [];
  }
}

// Get current user's rating for a specific player
export async function getMyRatingForPlayer(
  raterId: string,
  playerName: string
): Promise<PlayerRating | null> {
  return db.getMyRatingForPlayer(raterId, playerName);
}

// Get all ratings for a player (from all raters)
export async function getPlayerRatings(playerName: string): Promise<PlayerRating[]> {
  return db.getPlayerRatings(playerName);
}

// Get rating history for a player (optionally filtered by rater)
export async function getRatingHistory(
  playerName: string,
  raterId?: string
): Promise<RatingHistoryEntry[]> {
  return db.getRatingHistory(playerName, raterId);
}

// Save a rating (creates history entry automatically)
export async function saveRating(rating: Omit<PlayerRating, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlayerRating> {
  const result = await db.saveRating(rating);
  invalidateRatingsCache();
  return result;
}

// Delete a specific rating
export async function deleteRating(ratingId: string): Promise<boolean> {
  const result = await db.deleteRating(ratingId);
  invalidateRatingsCache();
  return result;
}

// Delete all ratings by a specific rater
export async function deleteRatingsByRater(raterId: string): Promise<number> {
  const result = await db.deleteRatingsByRater(raterId);
  invalidateRatingsCache();
  return result;
}

// Calculate average rating across all rated skills (excludes unrated optional skills)
export function calculateAverageRating(ratings: PlayerRatings): number {
  const values = Object.values(ratings).filter(val => val !== undefined && val >= 1);
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

// Format rating for display (e.g., "2.3")
export function formatRating(value: number): string {
  return value.toFixed(1);
}

// All skills are required
const REQUIRED_SKILLS: (keyof PlayerRatings)[] = [
  'passCatch', 'attackingThreat', 'tackleTech', 'physicality',
  'tacticalAwareness', 'character', 'overallSense',
  'speedPace', 'tacticalKicking', 'goalKicking'
];

// Create empty ratings object with all zeros
export function createEmptyRatings(): PlayerRatings {
  return {
    passCatch: 0,
    attackingThreat: 0,
    tackleTech: 0,
    physicality: 0,
    tacticalAwareness: 0,
    character: 0,
    overallSense: 0,
    speedPace: 0,
    tacticalKicking: 0,
    goalKicking: 0,
  };
}

// Check if ratings are complete (all skills must have a value 1-5)
export function areRatingsComplete(ratings: PlayerRatings): boolean {
  return REQUIRED_SKILLS.every(key => {
    const value = ratings[key];
    return value !== undefined && value >= 1 && value <= 5;
  });
}
