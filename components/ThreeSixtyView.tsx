import React, { useMemo } from 'react';
import { Users, CheckCircle, AlertTriangle, AlertCircle, User, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Player, PlayerRating } from '../types';
import { ROSTER_PLAYERS, getPhotoUrl, GROUP_COLORS } from '../services/rosterData';
import {
  aggregatePlayerRatings,
  VARIANCE_COLORS,
  AggregatedSkill,
  isSelfRating,
} from '../services/ratingAnalytics';
import { RATING_COLORS, calculateAverageRating } from '../services/ratingData';

interface Props {
  allRatings: PlayerRating[];
  selectedPlayer: string;
  currentPlayer?: Player | null;
}

const ThreeSixtyView: React.FC<Props> = ({ allRatings, selectedPlayer, currentPlayer }) => {
  // Get aggregated data for selected player
  const aggregation = useMemo(() => {
    if (!selectedPlayer) return null;
    return aggregatePlayerRatings(allRatings, currentPlayer?.id, selectedPlayer);
  }, [allRatings, selectedPlayer, currentPlayer?.id]);

  // Get roster player info
  const rosterPlayer = useMemo(() => {
    if (!selectedPlayer) return null;
    return ROSTER_PLAYERS.find(
      p => p.name.toLowerCase().trim() === selectedPlayer.toLowerCase().trim()
    );
  }, [selectedPlayer]);

  // Check if viewing own profile
  const isViewingOwnProfile = useMemo(() => {
    if (!currentPlayer || !selectedPlayer) return false;
    return currentPlayer.name.toLowerCase().trim() === selectedPlayer.toLowerCase().trim();
  }, [currentPlayer, selectedPlayer]);

  // Get list of raters for this player with all their ratings
  const raters = useMemo(() => {
    if (!selectedPlayer) return [];

    const playerRatings = allRatings.filter(
      r => r.playerName.toLowerCase().trim() === selectedPlayer.toLowerCase().trim()
    );

    return playerRatings.map(r => ({
      name: r.raterName,
      isSelf: isSelfRating(r),
      isCurrentUser: r.raterId === currentPlayer?.id,
      averageRating: calculateAverageRating(r.ratings),
      ratings: r.ratings,
      updatedAt: r.updatedAt,
    })).sort((a, b) => {
      // Self first, then current user, then by name
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allRatings, selectedPlayer, currentPlayer?.id]);

  if (!selectedPlayer) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <Users size={48} className="mb-4" />
        <p className="text-center">Select a player to view their 360-degree feedback</p>
      </div>
    );
  }

  if (!aggregation) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <AlertCircle size={48} className="mb-4" />
        <p className="text-center">No ratings found for {selectedPlayer}</p>
        <p className="text-sm mt-2">Be the first to rate this player!</p>
      </div>
    );
  }

  const renderVarianceIcon = (level: AggregatedSkill['varianceLevel']) => {
    switch (level) {
      case 'low':
        return <CheckCircle size={14} className={VARIANCE_COLORS.low.icon} />;
      case 'medium':
        return <AlertTriangle size={14} className={VARIANCE_COLORS.medium.icon} />;
      case 'high':
        return <AlertTriangle size={14} className={VARIANCE_COLORS.high.icon} />;
    }
  };

  const renderRatingBar = (skill: AggregatedSkill) => {
    const barWidth = (skill.mean / 5) * 100;
    const minPosition = ((skill.min - 1) / 4) * 100;
    const maxPosition = ((skill.max - 1) / 4) * 100;
    const rangeWidth = maxPosition - minPosition;

    return (
      <div className="relative h-3 bg-neutral-800 rounded-full overflow-hidden">
        {/* Mean bar */}
        <div
          className="absolute top-0 left-0 h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${barWidth}%` }}
        />
        {/* Range indicator (min to max) */}
        {skill.count > 1 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1 bg-white/30 rounded-full"
            style={{
              left: `${minPosition}%`,
              width: `${rangeWidth}%`,
              minWidth: '4px',
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Player Header */}
      <div className="flex items-center gap-4 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        {rosterPlayer ? (
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
            <img
              src={getPhotoUrl(rosterPlayer.name)}
              alt={rosterPlayer.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>';
              }}
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
            <User size={32} className="text-neutral-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white truncate">{selectedPlayer}</h2>
          {rosterPlayer && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded ${GROUP_COLORS[rosterPlayer.trainingGroup]?.bg} ${GROUP_COLORS[rosterPlayer.trainingGroup]?.text}`}>
                {rosterPlayer.trainingGroup}
              </span>
              <span className="text-xs text-neutral-500">{rosterPlayer.squad}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-amber-500">{aggregation.overallMean.toFixed(1)}</div>
          <div className="text-xs text-neutral-500">{aggregation.totalRaters} rater{aggregation.totalRaters !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Raters Section - Full Breakdown */}
      {raters.length > 0 && (
        <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
          <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Star size={14} />
            All Ratings ({raters.length} rater{raters.length !== 1 ? 's' : ''})
          </h3>

          {/* Scrollable table */}
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700">
                  <th className="text-left py-2 pr-3 text-neutral-500 font-medium sticky left-0 bg-neutral-900">Rater</th>
                  {aggregation.skills.map(skill => (
                    <th key={skill.skill} className="px-2 py-2 text-neutral-500 font-medium text-center min-w-[50px]">
                      <span className="text-[10px]">{skill.shortLabel}</span>
                    </th>
                  ))}
                  <th className="pl-3 py-2 text-neutral-500 font-medium text-center">Avg</th>
                </tr>
              </thead>
              <tbody>
                {raters.map((rater, idx) => (
                  <tr
                    key={`${rater.name}-${idx}`}
                    className={`border-b border-neutral-800 ${
                      rater.isSelf
                        ? 'bg-blue-500/10'
                        : rater.isCurrentUser
                          ? 'bg-amber-500/10'
                          : ''
                    }`}
                  >
                    <td className={`py-2 pr-3 sticky left-0 ${
                      rater.isSelf
                        ? 'bg-blue-500/10'
                        : rater.isCurrentUser
                          ? 'bg-amber-500/10'
                          : 'bg-neutral-900'
                    }`}>
                      <div className="flex items-center gap-1">
                        <span className={`font-medium truncate max-w-[100px] ${
                          rater.isSelf ? 'text-blue-400' : rater.isCurrentUser ? 'text-amber-400' : 'text-white'
                        }`}>
                          {rater.name.split(' ')[0]}
                        </span>
                        {rater.isSelf && <span className="text-[8px] text-blue-400">(S)</span>}
                        {rater.isCurrentUser && !rater.isSelf && <span className="text-[8px] text-amber-400">(Y)</span>}
                      </div>
                    </td>
                    {aggregation.skills.map(skill => {
                      const value = rater.ratings[skill.skill];
                      const hasValue = value !== undefined && value > 0;
                      return (
                        <td key={skill.skill} className="px-2 py-2 text-center">
                          {hasValue ? (
                            <span className={`inline-block w-6 h-6 leading-6 rounded text-xs font-bold ${
                              RATING_COLORS[value]?.bg || 'bg-neutral-700'
                            } ${RATING_COLORS[value]?.text || 'text-neutral-400'}`}>
                              {value}
                            </span>
                          ) : (
                            <span className="text-neutral-600">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="pl-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        RATING_COLORS[Math.round(rater.averageRating)]?.bg || 'bg-neutral-700'
                      } ${RATING_COLORS[Math.round(rater.averageRating)]?.text || 'text-neutral-400'}`}>
                        {rater.averageRating.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Team Average Row */}
                <tr className="bg-neutral-800/50">
                  <td className="py-2 pr-3 sticky left-0 bg-neutral-800/50">
                    <span className="font-bold text-amber-500">Team Avg</span>
                  </td>
                  {aggregation.skills.map(skill => (
                    <td key={skill.skill} className="px-2 py-2 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded text-xs font-bold ${
                        RATING_COLORS[Math.round(skill.mean)]?.bg || 'bg-neutral-700'
                      } ${RATING_COLORS[Math.round(skill.mean)]?.text || 'text-neutral-400'}`}>
                        {skill.mean.toFixed(1)}
                      </span>
                    </td>
                  ))}
                  <td className="pl-3 py-2 text-center">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-500 text-black">
                      {aggregation.overallMean.toFixed(1)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-neutral-800 flex flex-wrap gap-3 text-[10px] text-neutral-500">
            <span>(S) = Self-rating</span>
            <span>(Y) = Your rating</span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-red-500/20 text-red-400 text-center leading-4 font-bold">1</span>
              Novice
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-orange-500/20 text-orange-400 text-center leading-4 font-bold">2</span>
              Developing
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-blue-500/20 text-blue-400 text-center leading-4 font-bold">3</span>
              Competent
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-purple-500/20 text-purple-400 text-center leading-4 font-bold">4</span>
              Proficient
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-green-500/20 text-green-400 text-center leading-4 font-bold">5</span>
              Outstanding
            </span>
          </div>
        </div>
      )}

      {/* Self vs Peers Section */}
      {aggregation.selfRating !== undefined && aggregation.peerMean !== undefined && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
            <User size={16} />
            Self vs Peers
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-neutral-500 mb-1">Self-assessment</p>
              <p className="text-xl font-bold text-white">{aggregation.selfRating.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1">Peer average</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-white">{aggregation.peerMean.toFixed(1)}</p>
                {(() => {
                  const diff = aggregation.selfRating! - aggregation.peerMean!;
                  if (Math.abs(diff) < 0.1) return null;
                  return diff > 0 ? (
                    <span className="text-sm text-yellow-400 flex items-center">
                      <TrendingDown size={14} className="mr-0.5" />
                      -{Math.abs(diff).toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-sm text-green-400 flex items-center">
                      <TrendingUp size={14} className="mr-0.5" />
                      +{Math.abs(diff).toFixed(1)}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
          {(() => {
            const diff = aggregation.selfRating! - aggregation.peerMean!;
            if (Math.abs(diff) < 0.2) {
              return <p className="text-xs text-neutral-400 mt-3">Self-assessment aligns well with peer feedback</p>;
            } else if (diff > 0) {
              return <p className="text-xs text-yellow-400 mt-3">Self-rating is higher than peer average by {diff.toFixed(1)} points</p>;
            } else {
              return <p className="text-xs text-green-400 mt-3">Peers rate higher than self-assessment by {Math.abs(diff).toFixed(1)} points</p>;
            }
          })()}
        </div>
      )}

      {/* Skill Breakdown */}
      <div>
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">
          Skill Breakdown
        </h3>
        <div className="space-y-4">
          {aggregation.skills.map(skill => (
            <div key={skill.skill} className="p-3 bg-neutral-900 rounded-lg border border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{skill.label}</span>
                  {skill.count > 1 && (
                    <span className="text-[10px] text-neutral-500">({skill.count} ratings)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${RATING_COLORS[Math.round(skill.mean)]?.bg} ${RATING_COLORS[Math.round(skill.mean)]?.text}`}>
                    {skill.mean.toFixed(1)}
                  </span>
                  <div className={`p-1 rounded ${VARIANCE_COLORS[skill.varianceLevel].bg}`}>
                    {renderVarianceIcon(skill.varianceLevel)}
                  </div>
                </div>
              </div>

              {/* Rating bar */}
              {renderRatingBar(skill)}

              {/* Range info */}
              {skill.count > 1 && (
                <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                  <span>Min: {skill.min}</span>
                  <span>Max: {skill.max}</span>
                </div>
              )}

              {/* Self and my rating comparison */}
              {(skill.selfRating || skill.myRating) && (
                <div className="flex gap-3 mt-2 pt-2 border-t border-neutral-800 text-xs">
                  {skill.selfRating && (
                    <span className="text-neutral-400">
                      Self: <span className="text-white font-medium">{skill.selfRating}</span>
                    </span>
                  )}
                  {skill.myRating && !isViewingOwnProfile && (
                    <span className="text-neutral-400">
                      Your rating: <span className="text-amber-400 font-medium">{skill.myRating}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Variance warning */}
              {skill.varianceLevel === 'high' && skill.count > 1 && (
                <p className="text-[10px] text-red-400 mt-2">
                  High variance - raters disagree on this skill
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Variance Legend</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={12} className={VARIANCE_COLORS.low.icon} />
            <span className="text-neutral-400">Low - Strong consensus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className={VARIANCE_COLORS.medium.icon} />
            <span className="text-neutral-400">Medium - Some disagreement</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className={VARIANCE_COLORS.high.icon} />
            <span className="text-neutral-400">High - Significant disagreement</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeSixtyView;
