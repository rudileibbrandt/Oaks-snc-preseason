import React, { useMemo } from 'react';
import { Users, AlertCircle, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import { Player, PlayerRating } from '../types';
import { calculateMyRatingVsTeam, RatingComparison } from '../services/ratingAnalytics';

interface Props {
  allRatings: PlayerRating[];
  selectedPlayer: string;
  currentPlayer?: Player | null;
}

const MyRatingsComparison: React.FC<Props> = ({ allRatings, selectedPlayer, currentPlayer }) => {
  // Calculate comparison data
  const comparisonData = useMemo(() => {
    if (!selectedPlayer || !currentPlayer?.id) return null;
    return calculateMyRatingVsTeam(allRatings, currentPlayer.id, selectedPlayer);
  }, [allRatings, selectedPlayer, currentPlayer?.id]);

  // Check if user has rated this player
  const hasRated = useMemo(() => {
    if (!selectedPlayer || !currentPlayer?.id) return false;
    return allRatings.some(
      r => r.raterId === currentPlayer.id &&
           r.playerName.toLowerCase().trim() === selectedPlayer.toLowerCase().trim()
    );
  }, [allRatings, selectedPlayer, currentPlayer?.id]);

  // Defense-in-depth: players can only view their own ratings
  const isPlayerRole = currentPlayer?.role?.toLowerCase() === 'player';
  if (isPlayerRole && selectedPlayer && currentPlayer?.name &&
      currentPlayer.name.toLowerCase().trim() !== selectedPlayer.toLowerCase().trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <AlertCircle size={48} className="mb-4" />
        <p className="text-center">You can only view your own feedback</p>
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <AlertCircle size={48} className="mb-4" />
        <p className="text-center">Please log in to see your feedback</p>
      </div>
    );
  }

  if (!selectedPlayer) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <Users size={48} className="mb-4" />
        <p className="text-center">Select a player to compare your feedback with others</p>
      </div>
    );
  }

  if (!hasRated) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <Star size={48} className="mb-4" />
        <p className="text-center">You haven't given feedback on {selectedPlayer} yet</p>
        <p className="text-sm mt-2">Give feedback in Players to see comparisons</p>
      </div>
    );
  }

  if (!comparisonData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <AlertCircle size={48} className="mb-4" />
        <p className="text-center">No other feedback to compare with</p>
        <p className="text-sm mt-2">You're the only rater for {selectedPlayer}</p>
      </div>
    );
  }

  const { comparisons, overallDiff } = comparisonData;

  const renderDiffIndicator = (diff: number) => {
    if (Math.abs(diff) < 0.1) {
      return (
        <div className="flex items-center gap-1 text-neutral-400">
          <Minus size={14} />
          <span>0.0</span>
        </div>
      );
    }

    if (diff > 0) {
      return (
        <div className="flex items-center gap-1 text-green-400">
          <TrendingUp size={14} />
          <span>+{diff.toFixed(1)}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-red-400">
        <TrendingDown size={14} />
        <span>{diff.toFixed(1)}</span>
      </div>
    );
  };

  const getRowColor = (diff: number): string => {
    if (Math.abs(diff) < 0.3) return 'border-neutral-800';
    if (diff > 0) return 'border-green-500/30 bg-green-500/5';
    return 'border-red-500/30 bg-red-500/5';
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className={`p-4 rounded-lg border ${
        Math.abs(overallDiff) < 0.2
          ? 'bg-neutral-900 border-neutral-800'
          : overallDiff > 0
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
      }`}>
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3">Overall Comparison</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Your feedback vs team average</p>
            <p className="text-xs text-neutral-500 mt-1">
              {comparisons.length} skill{comparisons.length !== 1 ? 's' : ''} compared
            </p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${
              Math.abs(overallDiff) < 0.2
                ? 'text-neutral-400'
                : overallDiff > 0
                  ? 'text-green-400'
                  : 'text-red-400'
            }`}>
              {overallDiff > 0 ? '+' : ''}{overallDiff.toFixed(1)}
            </div>
            <p className="text-xs text-neutral-500">
              {Math.abs(overallDiff) < 0.2
                ? 'Aligned with team'
                : overallDiff > 0
                  ? 'Higher than avg'
                  : 'Lower than avg'}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div>
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">
          Skill-by-Skill Comparison
        </h3>

        {/* Header */}
        <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-neutral-500 uppercase tracking-wider">
          <div>Skill</div>
          <div className="text-center">You</div>
          <div className="text-center">Team</div>
          <div className="text-right">Diff</div>
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {comparisons.map((comp: RatingComparison) => (
            <div
              key={comp.skill}
              className={`grid grid-cols-4 gap-2 px-4 py-3 rounded-lg border ${getRowColor(comp.difference)}`}
            >
              <div className="text-sm text-white font-medium truncate">
                {comp.skillLabel}
              </div>
              <div className="text-center">
                <span className="text-sm font-bold text-amber-400">
                  {comp.myRating}
                </span>
              </div>
              <div className="text-center">
                <span className="text-sm text-neutral-300">
                  {comp.teamAverage.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-end">
                {renderDiffIndicator(comp.difference)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interpretation Guide */}
      <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
          How to Read This
        </h3>
        <div className="space-y-2 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-green-400" />
            <span>Positive: You rated higher than team average</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown size={12} className="text-red-400" />
            <span>Negative: You rated lower than team average</span>
          </div>
          <div className="flex items-center gap-2">
            <Minus size={12} className="text-neutral-400" />
            <span>Zero: Your feedback matches team average</span>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-neutral-500">
          Large differences may indicate you see something others don't, or an opportunity for discussion.
        </p>
      </div>
    </div>
  );
};

export default MyRatingsComparison;
