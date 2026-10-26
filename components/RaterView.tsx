import React, { useState, useMemo } from 'react';
import { useRosterClasses } from '../hooks/useRosterContext';
import { ChevronDown, ChevronRight, User, Users } from 'lucide-react';
import { PlayerRating } from '../types';
import { RATING_COLORS, calculateAverageRating, RATING_SKILLS } from '../services/ratingData';
import { getPhotoUrl, ROSTER_PLAYERS } from '../services/rosterData';

interface Props {
  allRatings: PlayerRating[];
}

interface RaterSummary {
  raterId: string;
  raterName: string;
  ratings: PlayerRating[];
  playerCount: number;
  lastRatingDate: number;
}

const RaterView: React.FC<Props> = ({ allRatings }) => {
  const { squadInfo } = useRosterClasses();
  const [expandedRater, setExpandedRater] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<PlayerRating | null>(null);

  // Group ratings by rater
  const raterSummaries = useMemo(() => {
    const raterMap = new Map<string, RaterSummary>();

    allRatings.forEach(rating => {
      const existing = raterMap.get(rating.raterId);
      if (existing) {
        existing.ratings.push(rating);
        existing.playerCount = existing.ratings.length;
        if (rating.updatedAt > existing.lastRatingDate) {
          existing.lastRatingDate = rating.updatedAt;
        }
      } else {
        raterMap.set(rating.raterId, {
          raterId: rating.raterId,
          raterName: rating.raterName,
          ratings: [rating],
          playerCount: 1,
          lastRatingDate: rating.updatedAt,
        });
      }
    });

    // Sort by name
    return Array.from(raterMap.values()).sort((a, b) =>
      a.raterName.localeCompare(b.raterName)
    );
  }, [allRatings]);

  const handleToggleRater = (raterId: string) => {
    if (expandedRater === raterId) {
      setExpandedRater(null);
      setSelectedRating(null);
    } else {
      setExpandedRater(raterId);
      setSelectedRating(null);
    }
  };

  const handleSelectRating = (rating: PlayerRating) => {
    if (selectedRating?.id === rating.id) {
      setSelectedRating(null);
    } else {
      setSelectedRating(rating);
    }
  };

  if (raterSummaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <Users size={48} className="mb-4" />
        <p className="text-center">No feedback has been submitted yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2">
          Feedback by Rater
        </h3>
        <p className="text-xs text-neutral-500">
          {raterSummaries.length} rater{raterSummaries.length !== 1 ? 's' : ''} have submitted {allRatings.length} total feedback{allRatings.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Rater List */}
      <div className="space-y-2">
        {raterSummaries.map(rater => {
          const isExpanded = expandedRater === rater.raterId;
          const raterPhotoUrl = getPhotoUrl(rater.raterName);

          return (
            <div
              key={rater.raterId}
              className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden"
            >
              {/* Rater Header */}
              <button
                onClick={() => handleToggleRater(rater.raterId)}
                className="w-full p-4 flex items-center gap-3 hover:bg-neutral-800/50 transition-colors"
              >
                {/* Expand Icon */}
                <div className="text-neutral-500">
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>

                {/* Rater Photo */}
                <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                  {raterPhotoUrl ? (
                    <img
                      src={raterPhotoUrl}
                      alt={rater.raterName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center ${raterPhotoUrl ? 'hidden' : ''}`}>
                    <User size={20} className="text-neutral-600" />
                  </div>
                </div>

                {/* Rater Info */}
                <div className="flex-1 text-left">
                  <p className="font-medium text-white">{rater.raterName}</p>
                  <p className="text-xs text-neutral-500">
                    Last rated: {new Date(rater.lastRatingDate).toLocaleDateString()}
                  </p>
                </div>

                {/* Player Count Badge */}
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium">
                    {rater.playerCount} player{rater.playerCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>

              {/* Expanded Player List */}
              {isExpanded && (
                <div className="border-t border-neutral-800">
                  <div className="p-2 space-y-1">
                    {rater.ratings
                      .sort((a, b) => a.playerName.localeCompare(b.playerName))
                      .map(rating => {
                        const playerPhotoUrl = getPhotoUrl(rating.playerName);
                        const avgRating = calculateAverageRating(rating.ratings);
                        const isSelected = selectedRating?.id === rating.id;
                        const rosterPlayer = ROSTER_PLAYERS.find(
                          p => p.name.toLowerCase().trim() === rating.playerName.toLowerCase().trim()
                        );

                        return (
                          <div key={rating.id}>
                            <button
                              onClick={() => handleSelectRating(rating)}
                              className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors ${
                                isSelected
                                  ? 'bg-amber-500/20 border border-amber-500/30'
                                  : 'hover:bg-neutral-800 border border-transparent'
                              }`}
                            >
                              {/* Player Photo */}
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                                {playerPhotoUrl ? (
                                  <img
                                    src={playerPhotoUrl}
                                    alt={rating.playerName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <User size={16} className="text-neutral-600" />
                                  </div>
                                )}
                              </div>

                              {/* Player Info */}
                              <div className="flex-1 text-left min-w-0">
                                <p className="font-medium text-white truncate">{rating.playerName}</p>
                                {rosterPlayer && (
                                  <p className="text-xs text-neutral-500 truncate">
                                    {squadInfo(rosterPlayer).squad} • {rosterPlayer.trainingGroup}
                                  </p>
                                )}
                              </div>

                              {/* Average Rating */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-neutral-500">
                                  {new Date(rating.updatedAt).toLocaleDateString()}
                                </span>
                                <span className={`px-2 py-1 rounded text-sm font-bold ${
                                  RATING_COLORS[Math.round(avgRating)]?.bg || 'bg-neutral-700'
                                } ${RATING_COLORS[Math.round(avgRating)]?.text || 'text-neutral-400'}`}>
                                  {avgRating.toFixed(1)}
                                </span>
                              </div>
                            </button>

                            {/* Expanded Rating Details */}
                            {isSelected && (
                              <div className="ml-11 mr-2 mb-2 p-3 bg-neutral-800/50 rounded-lg">
                                <div className="grid grid-cols-2 gap-2">
                                  {RATING_SKILLS.map(skill => {
                                    const value = rating.ratings[skill.key];
                                    const hasValue = value !== undefined && value > 0;
                                    return (
                                      <div
                                        key={skill.key}
                                        className="flex items-center justify-between text-xs"
                                      >
                                        <span className="text-neutral-400">{skill.shortLabel}</span>
                                        {hasValue ? (
                                          <span className={`w-6 h-6 rounded flex items-center justify-center font-bold ${
                                            RATING_COLORS[value]?.bg || 'bg-neutral-700'
                                          } ${RATING_COLORS[value]?.text || 'text-neutral-400'}`}>
                                            {value}
                                          </span>
                                        ) : (
                                          <span className="text-neutral-600">-</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Feedback Scale</h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold">1</span>
            <span className="text-neutral-400">Novice</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">2</span>
            <span className="text-neutral-400">Developing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">3</span>
            <span className="text-neutral-400">Competent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">4</span>
            <span className="text-neutral-400">Proficient</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-green-500/20 text-green-400 flex items-center justify-center font-bold">5</span>
            <span className="text-neutral-400">Outstanding</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RaterView;
