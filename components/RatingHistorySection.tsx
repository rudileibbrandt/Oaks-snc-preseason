import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Loader2, Star } from 'lucide-react';
import { RatingHistoryEntry, Player } from '../types';
import { getRatingHistory, RATING_SKILLS, RATING_COLORS, calculateAverageRating } from '../services/ratingData';

interface Props {
  playerName: string;
  currentPlayer: Player;
}

const RatingHistorySection: React.FC<Props> = ({ playerName, currentPlayer }) => {
  const [history, setHistory] = useState<RatingHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        // Load only current user's rating history for this player
        const historyData = await getRatingHistory(playerName, currentPlayer.id);
        setHistory(historyData);
        console.log('[RatingHistorySection] Loaded history:', historyData.length, 'entries');
      } catch (error) {
        console.error('[RatingHistorySection] Failed to load history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (currentPlayer?.id) {
      loadHistory();
    }
  }, [playerName, currentPlayer?.id]);

  if (isLoading) {
    return (
      <div className="mt-4 p-4 bg-neutral-800/50 rounded-lg">
        <div className="flex items-center gap-2 text-neutral-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading rating history...</span>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  // Calculate trend between two most recent entries
  const getTrend = (): 'up' | 'down' | 'same' | null => {
    if (history.length < 2) return null;
    const current = calculateAverageRating(history[0].ratings);
    const previous = calculateAverageRating(history[1].ratings);
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'same';
  };

  const trend = getTrend();

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Star size={16} className="text-amber-400" />
        <h3 className="text-sm font-bold text-white">Your Rating History</h3>
        <span className="text-xs text-neutral-500">({history.length} {history.length === 1 ? 'entry' : 'entries'})</span>
        {trend && (
          <span className="ml-auto">
            {trend === 'up' && <TrendingUp size={16} className="text-green-400" />}
            {trend === 'down' && <TrendingDown size={16} className="text-red-400" />}
            {trend === 'same' && <Minus size={16} className="text-neutral-400" />}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {history.map((entry, index) => (
          <RatingHistoryCard
            key={entry.id}
            entry={entry}
            previousEntry={history[index + 1]}
            isExpanded={expandedId === entry.id}
            onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            isLatest={index === 0}
          />
        ))}
      </div>
    </div>
  );
};

interface RatingHistoryCardProps {
  entry: RatingHistoryEntry;
  previousEntry?: RatingHistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
  isLatest: boolean;
}

const RatingHistoryCard: React.FC<RatingHistoryCardProps> = ({
  entry,
  previousEntry,
  isExpanded,
  onToggle,
  isLatest,
}) => {
  const average = calculateAverageRating(entry.ratings);
  const previousAverage = previousEntry ? calculateAverageRating(previousEntry.ratings) : null;

  // Calculate overall change
  const getOverallTrend = (): 'up' | 'down' | 'same' | null => {
    if (!previousAverage) return null;
    if (average > previousAverage) return 'up';
    if (average < previousAverage) return 'down';
    return 'same';
  };

  const overallTrend = getOverallTrend();

  return (
    <div className={`rounded-lg border overflow-hidden ${
      isLatest
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-neutral-800/50 border-neutral-700/50'
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-3 text-left"
      >
        {/* Average rating circle */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          average >= 4.5 ? 'bg-green-500/20' : average >= 3.5 ? 'bg-purple-500/20' : average >= 2.5 ? 'bg-blue-500/20' : average >= 1.5 ? 'bg-orange-500/20' : 'bg-red-500/20'
        }`}>
          <span className={`text-sm font-bold ${
            average >= 4.5 ? 'text-green-400' : average >= 3.5 ? 'text-purple-400' : average >= 2.5 ? 'text-blue-400' : average >= 1.5 ? 'text-orange-400' : 'text-red-400'
          }`}>
            {average.toFixed(1)}
          </span>
        </div>

        {/* Date and trend */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">
              {new Date(entry.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            {isLatest && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                Current
              </span>
            )}
            {overallTrend && !isLatest && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                overallTrend === 'up' ? 'bg-green-500/20 text-green-400' :
                overallTrend === 'down' ? 'bg-red-500/20 text-red-400' :
                'bg-neutral-700 text-neutral-400'
              }`}>
                {overallTrend === 'up' && <TrendingUp size={10} />}
                {overallTrend === 'down' && <TrendingDown size={10} />}
                {overallTrend === 'same' && <Minus size={10} />}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            {new Date(entry.timestamp).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Expand icon */}
        {isExpanded ? (
          <ChevronUp size={16} className="text-neutral-500 flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-neutral-500 flex-shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-neutral-700/50">
          <div className="grid grid-cols-2 gap-2 mt-2">
            {RATING_SKILLS.map(skill => {
              const value = entry.ratings[skill.key] ?? 0;
              const prevValue = previousEntry?.ratings[skill.key] ?? 0;
              if (value === 0 && prevValue === 0) return null; // Skip unrated optional skills
              const changed = prevValue !== value && prevValue > 0;
              const improved = changed && value > prevValue;
              const declined = changed && value < prevValue;

              return (
                <div
                  key={skill.key}
                  className={`flex items-center justify-between p-2 rounded ${
                    changed ? (improved ? 'bg-green-500/10' : declined ? 'bg-red-500/10' : 'bg-neutral-800/50') : 'bg-neutral-800/50'
                  }`}
                >
                  <span className="text-xs text-neutral-400">{skill.shortLabel}</span>
                  <div className="flex items-center gap-1">
                    {changed && prevValue > 0 && (
                      <span className={`text-[10px] ${improved ? 'text-green-400' : 'text-red-400'}`}>
                        {prevValue}→
                      </span>
                    )}
                    {value > 0 ? (
                      <span className={`text-sm font-bold px-1.5 py-0.5 rounded ${RATING_COLORS[value].bg} ${RATING_COLORS[value].text}`}>
                        {value}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-500">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RatingHistorySection;
