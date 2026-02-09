import { PlayerRating, PlayerRatings } from '../types';
import { RATING_SKILLS } from './ratingData';

// Variance thresholds for 1-5 scale
const VARIANCE_THRESHOLDS = {
  LOW: 0.7,    // StdDev < 0.7 = Strong consensus
  MEDIUM: 1.2, // 0.7 <= StdDev < 1.2 = Some disagreement
  // >= 1.2 = Significant disagreement
};

export type VarianceLevel = 'low' | 'medium' | 'high';

export interface AggregatedSkill {
  skill: keyof PlayerRatings;
  label: string;
  shortLabel: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
  selfRating?: number;
  myRating?: number;
  varianceLevel: VarianceLevel;
}

export interface VarianceHotspot {
  playerName: string;
  skill: keyof PlayerRatings;
  skillLabel: string;
  stdDev: number;
  mean: number;
  raterCount: number;
  varianceLevel: VarianceLevel;
}

export interface PlayerAggregation {
  playerName: string;
  overallMean: number;
  totalRaters: number;
  selfRating?: number;
  peerMean?: number;
  skills: AggregatedSkill[];
}

// Calculate variance level from standard deviation
export function calculateVarianceLevel(stdDev: number): VarianceLevel {
  if (stdDev < VARIANCE_THRESHOLDS.LOW) return 'low';
  if (stdDev < VARIANCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'high';
}

// Check if a rating is a self-rating (player rated themselves)
export function isSelfRating(rating: PlayerRating): boolean {
  return rating.playerName.toLowerCase().trim() ===
         rating.raterName.toLowerCase().trim();
}

// Calculate mean and standard deviation for an array of numbers
function calculateStats(values: number[]): { mean: number; stdDev: number; min: number; max: number } {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { mean, stdDev, min, max };
}

// Aggregate ratings for a specific player
export function aggregatePlayerRatings(
  allRatings: PlayerRating[],
  currentPlayerId?: string,
  playerName?: string
): PlayerAggregation | null {
  if (!playerName) return null;

  // Filter ratings for this player
  const playerRatings = allRatings.filter(
    r => r.playerName.toLowerCase().trim() === playerName.toLowerCase().trim()
  );

  if (playerRatings.length === 0) {
    return null;
  }

  // Separate self-rating from peer ratings
  const selfRatingRecord = playerRatings.find(r => isSelfRating(r));
  const peerRatings = playerRatings.filter(r => !isSelfRating(r));

  // Find current user's rating
  const myRatingRecord = currentPlayerId
    ? playerRatings.find(r => r.raterId === currentPlayerId)
    : undefined;

  // Aggregate each skill
  const skills: AggregatedSkill[] = RATING_SKILLS.map(skill => {
    // Get all values for this skill (excluding undefined/0)
    const allValues = playerRatings
      .map(r => r.ratings[skill.key])
      .filter((v): v is number => v !== undefined && v > 0);

    const stats = calculateStats(allValues);

    return {
      skill: skill.key,
      label: skill.label,
      shortLabel: skill.shortLabel,
      mean: Math.round(stats.mean * 10) / 10,
      stdDev: Math.round(stats.stdDev * 100) / 100,
      min: stats.min,
      max: stats.max,
      count: allValues.length,
      selfRating: selfRatingRecord?.ratings[skill.key],
      myRating: myRatingRecord?.ratings[skill.key],
      varianceLevel: calculateVarianceLevel(stats.stdDev),
    };
  }).filter(s => s.count > 0);

  // Calculate overall mean from all skills
  const allSkillMeans = skills.filter(s => s.mean > 0).map(s => s.mean);
  const overallMean = allSkillMeans.length > 0
    ? Math.round((allSkillMeans.reduce((a, b) => a + b, 0) / allSkillMeans.length) * 10) / 10
    : 0;

  // Calculate peer mean for comparison with self-rating
  let peerMean: number | undefined;
  if (selfRatingRecord && peerRatings.length > 0) {
    const peerSkillMeans = skills
      .filter(s => {
        const peerValues = peerRatings
          .map(r => r.ratings[s.skill])
          .filter((v): v is number => v !== undefined && v > 0);
        return peerValues.length > 0;
      })
      .map(s => {
        const peerValues = peerRatings
          .map(r => r.ratings[s.skill])
          .filter((v): v is number => v !== undefined && v > 0);
        return peerValues.reduce((a, b) => a + b, 0) / peerValues.length;
      });

    if (peerSkillMeans.length > 0) {
      peerMean = Math.round((peerSkillMeans.reduce((a, b) => a + b, 0) / peerSkillMeans.length) * 10) / 10;
    }
  }

  // Calculate self-rating overall
  let selfRatingOverall: number | undefined;
  if (selfRatingRecord) {
    const selfValues = Object.values(selfRatingRecord.ratings).filter(
      (v): v is number => v !== undefined && v > 0
    );
    if (selfValues.length > 0) {
      selfRatingOverall = Math.round((selfValues.reduce((a, b) => a + b, 0) / selfValues.length) * 10) / 10;
    }
  }

  return {
    playerName,
    overallMean,
    totalRaters: playerRatings.length,
    selfRating: selfRatingOverall,
    peerMean,
    skills,
  };
}

// Find variance hotspots across all players
export function findVarianceHotspots(allRatings: PlayerRating[]): VarianceHotspot[] {
  // Group ratings by player name
  const playerMap = new Map<string, PlayerRating[]>();

  allRatings.forEach(rating => {
    const key = rating.playerName.toLowerCase().trim();
    if (!playerMap.has(key)) {
      playerMap.set(key, []);
    }
    playerMap.get(key)!.push(rating);
  });

  const hotspots: VarianceHotspot[] = [];

  playerMap.forEach((ratings) => {
    // Only analyze players with multiple raters
    if (ratings.length < 2) return;

    const displayName = ratings[0].playerName;

    RATING_SKILLS.forEach(skill => {
      const values = ratings
        .map(r => r.ratings[skill.key])
        .filter((v): v is number => v !== undefined && v > 0);

      if (values.length < 2) return;

      const stats = calculateStats(values);
      const varianceLevel = calculateVarianceLevel(stats.stdDev);

      // Only include medium and high variance
      if (varianceLevel !== 'low') {
        hotspots.push({
          playerName: displayName,
          skill: skill.key,
          skillLabel: skill.label,
          stdDev: Math.round(stats.stdDev * 100) / 100,
          mean: Math.round(stats.mean * 10) / 10,
          raterCount: values.length,
          varianceLevel,
        });
      }
    });
  });

  // Sort by stdDev descending
  return hotspots.sort((a, b) => b.stdDev - a.stdDev);
}

// Calculate comparison between user's rating and team average
export interface RatingComparison {
  skill: keyof PlayerRatings;
  skillLabel: string;
  myRating: number;
  teamAverage: number;
  difference: number;
}

export function calculateMyRatingVsTeam(
  allRatings: PlayerRating[],
  currentPlayerId: string,
  playerName: string
): { comparisons: RatingComparison[]; overallDiff: number } | null {
  // Get ratings for this player
  const playerRatings = allRatings.filter(
    r => r.playerName.toLowerCase().trim() === playerName.toLowerCase().trim()
  );

  // Find current user's rating
  const myRating = playerRatings.find(r => r.raterId === currentPlayerId);
  if (!myRating) return null;

  // Get other ratings (exclude self)
  const otherRatings = playerRatings.filter(
    r => r.raterId !== currentPlayerId && !isSelfRating(r)
  );

  if (otherRatings.length === 0) return null;

  const comparisons: RatingComparison[] = [];

  RATING_SKILLS.forEach(skill => {
    const myValue = myRating.ratings[skill.key];
    if (!myValue || myValue === 0) return;

    const otherValues = otherRatings
      .map(r => r.ratings[skill.key])
      .filter((v): v is number => v !== undefined && v > 0);

    if (otherValues.length === 0) return;

    const teamAvg = otherValues.reduce((a, b) => a + b, 0) / otherValues.length;
    const diff = myValue - teamAvg;

    comparisons.push({
      skill: skill.key,
      skillLabel: skill.label,
      myRating: myValue,
      teamAverage: Math.round(teamAvg * 10) / 10,
      difference: Math.round(diff * 10) / 10,
    });
  });

  // Calculate overall difference
  const overallDiff = comparisons.length > 0
    ? Math.round((comparisons.reduce((sum, c) => sum + c.difference, 0) / comparisons.length) * 10) / 10
    : 0;

  return { comparisons, overallDiff };
}

// Get unique player names from all ratings
export function getPlayersWithRatings(allRatings: PlayerRating[]): string[] {
  const playerSet = new Set<string>();

  allRatings.forEach(rating => {
    playerSet.add(rating.playerName);
  });

  return Array.from(playerSet).sort((a, b) => a.localeCompare(b));
}

// Variance level colors for UI
export const VARIANCE_COLORS: Record<VarianceLevel, { bg: string; text: string; border: string; icon: string }> = {
  low: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
    icon: 'text-green-400'
  },
  medium: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-400'
  },
  high: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    icon: 'text-red-400'
  },
};
