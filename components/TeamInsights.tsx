import React, { useMemo, useState } from 'react';
import { AlertTriangle, AlertCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { PlayerRating } from '../types';
import { findVarianceHotspots, VARIANCE_COLORS, VarianceHotspot } from '../services/ratingAnalytics';
import { ROSTER_PLAYERS, GROUP_COLORS } from '../services/rosterData';

interface Props {
  allRatings: PlayerRating[];
}

const TeamInsights: React.FC<Props> = ({ allRatings }) => {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  // Find variance hotspots
  const hotspots = useMemo(() => {
    return findVarianceHotspots(allRatings);
  }, [allRatings]);

  // Group hotspots by player
  const hotspotsByPlayer = useMemo(() => {
    const grouped = new Map<string, VarianceHotspot[]>();

    hotspots.forEach(hotspot => {
      const key = hotspot.playerName.toLowerCase().trim();
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(hotspot);
    });

    // Sort by total high-variance count
    return Array.from(grouped.entries())
      .map(([_key, spots]) => ({
        playerName: spots[0].playerName,
        hotspots: spots,
        highCount: spots.filter(s => s.varianceLevel === 'high').length,
        mediumCount: spots.filter(s => s.varianceLevel === 'medium').length,
      }))
      .sort((a, b) => {
        // Sort by high count first, then medium
        if (a.highCount !== b.highCount) return b.highCount - a.highCount;
        return b.mediumCount - a.mediumCount;
      });
  }, [hotspots]);

  // Get roster player info
  const getPlayerGroup = (playerName: string): string | null => {
    const player = ROSTER_PLAYERS.find(
      p => p.name.toLowerCase().trim() === playerName.toLowerCase().trim()
    );
    return player?.trainingGroup || null;
  };

  // Count stats
  const stats = useMemo(() => {
    const playersWithHighVariance = new Set(
      hotspots.filter(h => h.varianceLevel === 'high').map(h => h.playerName.toLowerCase().trim())
    ).size;

    const totalHighVariance = hotspots.filter(h => h.varianceLevel === 'high').length;
    const totalMediumVariance = hotspots.filter(h => h.varianceLevel === 'medium').length;

    return { playersWithHighVariance, totalHighVariance, totalMediumVariance };
  }, [hotspots]);

  if (hotspots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <Users size={48} className="mb-4" />
        <p className="text-center">No variance hotspots found</p>
        <p className="text-sm mt-2">All feedback shows strong consensus</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-400">{stats.totalHighVariance}</div>
          <div className="text-xs text-neutral-500">High Variance</div>
        </div>
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.totalMediumVariance}</div>
          <div className="text-xs text-neutral-500">Medium Variance</div>
        </div>
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{stats.playersWithHighVariance}</div>
          <div className="text-xs text-neutral-500">Players Affected</div>
        </div>
      </div>

      {/* Explanation */}
      <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-white mb-1">What is Variance?</h3>
            <p className="text-xs text-neutral-400">
              Variance shows where raters disagree. High variance skills are opportunities
              for alignment conversations - coaches and players may see different things.
            </p>
          </div>
        </div>
      </div>

      {/* Hotspots by Player */}
      <div>
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">
          Players with Feedback Disagreement
        </h3>

        <div className="space-y-3">
          {hotspotsByPlayer.map(({ playerName, hotspots: playerHotspots, highCount, mediumCount }) => {
            const isExpanded = expandedPlayer === playerName.toLowerCase().trim();
            const group = getPlayerGroup(playerName);

            return (
              <div
                key={playerName}
                className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden"
              >
                {/* Player Header */}
                <button
                  onClick={() => setExpandedPlayer(
                    isExpanded ? null : playerName.toLowerCase().trim()
                  )}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{playerName}</span>
                        {group && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${GROUP_COLORS[group]?.bg} ${GROUP_COLORS[group]?.text}`}>
                            {group}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {highCount > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-red-400">
                            <AlertTriangle size={10} />
                            {highCount} high
                          </span>
                        )}
                        {mediumCount > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                            <AlertTriangle size={10} />
                            {mediumCount} medium
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={20} className="text-neutral-500" />
                  ) : (
                    <ChevronDown size={20} className="text-neutral-500" />
                  )}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-neutral-800 p-4 space-y-3">
                    {playerHotspots.map((hotspot, idx) => (
                      <div
                        key={`${hotspot.skill}-${idx}`}
                        className={`p-3 rounded-lg border ${VARIANCE_COLORS[hotspot.varianceLevel].bg} ${VARIANCE_COLORS[hotspot.varianceLevel].border}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle
                              size={14}
                              className={VARIANCE_COLORS[hotspot.varianceLevel].icon}
                            />
                            <span className="text-sm font-medium text-white">
                              {hotspot.skillLabel}
                            </span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${VARIANCE_COLORS[hotspot.varianceLevel].bg} ${VARIANCE_COLORS[hotspot.varianceLevel].text}`}>
                            {hotspot.varianceLevel.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-neutral-500">Mean</span>
                            <p className="text-white font-medium">{hotspot.mean.toFixed(1)}</p>
                          </div>
                          <div>
                            <span className="text-neutral-500">Std Dev</span>
                            <p className="text-white font-medium">{hotspot.stdDev.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-neutral-500">Raters</span>
                            <p className="text-white font-medium">{hotspot.raterCount}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Coach Action Items */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <h3 className="text-sm font-bold text-amber-400 mb-3">Suggested Actions</h3>
        <ul className="space-y-2 text-xs text-neutral-300">
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">1.</span>
            <span>Review high-variance skills with the player to understand different perspectives</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">2.</span>
            <span>Calibrate feedback with other coaches to ensure consistent assessment criteria</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">3.</span>
            <span>Use high-variance areas as development focus points in training</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default TeamInsights;
