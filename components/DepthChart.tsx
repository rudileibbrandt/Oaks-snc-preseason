import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { AppView, Player, RugbyPosition, POSITION_NAMES, POSITION_SHORT, RosterPlayer, PlayerRating } from '../types';
import { ROSTER_PLAYERS, GROUP_COLORS, getPhotoUrl } from '../services/rosterData';
import { loadPositionOverrides } from '../services/positionData';
import { loadRatings } from '../services/ratingData';
import { aggregatePlayerRatings } from '../services/ratingAnalytics';
import { db } from '../services/db';
import { normalizeName } from '../services/alumni';
import { rosterAlumniNames } from '../services/classYears';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

interface DepthEntry {
  player: RosterPlayer;
  rating: number; // overallMean
  totalRaters: number;
  positionType: 'best' | 'second' | 'third';
  photoUrl?: string;
}

type ViewMode = 'formation' | 'list' | 'bestxv' | 'pools';

const DepthChart: React.FC<Props> = ({ onNavigate }) => {
  const [allRatings, setAllRatings] = useState<PlayerRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('formation');
  const [expandedPosition, setExpandedPosition] = useState<RugbyPosition | null>(null);
  const [showBackups, setShowBackups] = useState(true);
  const [squadFilter, setSquadFilter] = useState<'all' | '1sts and 2nds' | 'Academy'>('1sts and 2nds');
  const [primaryOnly, setPrimaryOnly] = useState(false);

  // Alumni (graduated players) are left off the depth chart, matched by name.
  const [alumniNames, setAlumniNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRatings().then(ratings => {
      setAllRatings(ratings);
      setLoading(false);
    }).catch(() => setLoading(false));
    Promise.all([db.getPlayers().catch(() => []), db.getRosterClasses().catch(() => ({}))])
      .then(([players, classes]) => setAlumniNames(rosterAlumniNames(players, classes)))
      .catch(err => console.error('[DepthChart] Could not load alumni:', err));
  }, []);

  // Current squad: the squad filter, minus alumni.
  const squadPlayers = useMemo(() => ROSTER_PLAYERS.filter(p =>
    (squadFilter === 'all' || p.squad === squadFilter) && !alumniNames.has(normalizeName(p.name))
  ), [squadFilter, alumniNames]);

  // Build depth chart data
  const depthByPosition = useMemo(() => {
    const overrides = loadPositionOverrides();
    const positions: Record<number, DepthEntry[]> = {};

    // Initialize all 15 positions
    for (let i = 1; i <= 15; i++) {
      positions[i] = [];
    }

    const filteredPlayers = squadPlayers;

    filteredPlayers.forEach(player => {
      // Merge overrides with hardcoded data
      const override = overrides[player.name];
      const best = override?.bestPosition ?? player.bestPosition;
      const second = override?.secondPosition ?? player.secondPosition;
      const third = override?.thirdPosition ?? player.thirdPosition;

      // Get player's aggregated rating
      const agg = aggregatePlayerRatings(allRatings, undefined, player.name);
      const rating = agg?.overallMean ?? 0;
      const totalRaters = agg?.totalRaters ?? 0;
      const photoUrl = getPhotoUrl(player.name);

      if (best) {
        positions[best].push({ player, rating, totalRaters, positionType: 'best', photoUrl });
      }
      if (!primaryOnly && second) {
        positions[second].push({ player, rating, totalRaters, positionType: 'second', photoUrl });
      }
      if (!primaryOnly && third) {
        positions[third].push({ player, rating, totalRaters, positionType: 'third', photoUrl });
      }
    });

    // Sort each position by: best > second > third, then by rating descending
    const typeOrder = { best: 0, second: 1, third: 2 };
    Object.keys(positions).forEach(pos => {
      positions[Number(pos)].sort((a, b) => {
        if (a.positionType !== b.positionType) {
          return typeOrder[a.positionType] - typeOrder[b.positionType];
        }
        return b.rating - a.rating;
      });
    });

    return positions;
  }, [allRatings, squadPlayers, primaryOnly]);

  // Best XV: assign best 15 players across all positions, no duplicates
  const bestXV = useMemo(() => {
    const overrides = loadPositionOverrides();
    const filteredPlayers = squadPlayers;

    // Build candidate list: (player, position, rating, positionType, weight)
    // Weight: best=1.0, second=0.95, third=0.9 (slight preference for natural position)
    const candidates: { player: RosterPlayer; pos: RugbyPosition; rating: number; totalRaters: number; positionType: 'best' | 'second' | 'third'; weight: number; photoUrl?: string }[] = [];
    const posTypeWeight = { best: 1.0, second: 0.95, third: 0.9 };

    filteredPlayers.forEach(player => {
      const override = overrides[player.name];
      const best = override?.bestPosition ?? player.bestPosition;
      const second = override?.secondPosition ?? player.secondPosition;
      const third = override?.thirdPosition ?? player.thirdPosition;

      const agg = aggregatePlayerRatings(allRatings, undefined, player.name);
      const rating = agg?.overallMean ?? 0;
      const totalRaters = agg?.totalRaters ?? 0;
      const photoUrl = getPhotoUrl(player.name);

      if (best) candidates.push({ player, pos: best, rating, totalRaters, positionType: 'best', weight: rating * posTypeWeight.best, photoUrl });
      if (second) candidates.push({ player, pos: second, rating, totalRaters, positionType: 'second', weight: rating * posTypeWeight.second, photoUrl });
      if (third) candidates.push({ player, pos: third, rating, totalRaters, positionType: 'third', weight: rating * posTypeWeight.third, photoUrl });
    });

    // Sort by weighted rating descending
    candidates.sort((a, b) => b.weight - a.weight);

    // Greedy assignment
    const assigned: Record<number, DepthEntry> = {};
    const usedPlayers = new Set<string>();

    for (const c of candidates) {
      if (assigned[c.pos] || usedPlayers.has(c.player.name)) continue;
      assigned[c.pos] = { player: c.player, rating: c.rating, totalRaters: c.totalRaters, positionType: c.positionType, photoUrl: c.photoUrl };
      usedPlayers.add(c.player.name);
      if (usedPlayers.size === 15) break;
    }

    return assigned;
  }, [allRatings, squadPlayers]);

  // Positional pools: group players by role, deduplicated, ranked by rating
  const POSITION_POOLS: { label: string; positions: RugbyPosition[] }[] = [
    { label: 'Front Row', positions: [1, 2, 3] },
    { label: 'Locks', positions: [4, 5] },
    { label: 'Loose Forwards', positions: [6, 7, 8] },
    { label: 'Halfbacks', positions: [9, 10] },
    { label: 'Centers', positions: [12, 13] },
    { label: 'Outside Backs', positions: [11, 14, 15] },
  ];

  const poolData = useMemo(() => {
    const overrides = loadPositionOverrides();
    const filteredPlayers = squadPlayers;

    return POSITION_POOLS.map(pool => {
      const posSet = new Set(pool.positions);
      const seen = new Set<string>();
      const entries: (DepthEntry & { assignedPos: RugbyPosition })[] = [];

      filteredPlayers.forEach(player => {
        const override = overrides[player.name];
        const best = override?.bestPosition ?? player.bestPosition;
        const second = override?.secondPosition ?? player.secondPosition;
        const third = override?.thirdPosition ?? player.thirdPosition;

        // Check if player belongs to this pool via any of their positions
        let matchPos: RugbyPosition | undefined;
        let matchType: 'best' | 'second' | 'third' = 'best';
        if (best && posSet.has(best)) { matchPos = best; matchType = 'best'; }
        else if (second && posSet.has(second)) { matchPos = second; matchType = 'second'; }
        else if (third && posSet.has(third)) { matchPos = third; matchType = 'third'; }

        if (!matchPos || seen.has(player.name)) return;
        seen.add(player.name);

        const agg = aggregatePlayerRatings(allRatings, undefined, player.name);
        const rating = agg?.overallMean ?? 0;
        const totalRaters = agg?.totalRaters ?? 0;
        const photoUrl = getPhotoUrl(player.name);

        entries.push({ player, rating, totalRaters, positionType: matchType, photoUrl, assignedPos: matchPos });
      });

      // Sort by rating descending only
      entries.sort((a, b) => b.rating - a.rating);

      return { ...pool, entries };
    });
  }, [allRatings, squadPlayers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-neutral-400">Loading depth chart...</div>
      </div>
    );
  }

  const posTypeBadge = (type: 'best' | 'second' | 'third') => {
    if (type === 'best') return <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">1st</span>;
    if (type === 'second') return <span className="text-[10px] font-bold bg-neutral-700 text-neutral-300 px-1.5 py-0.5 rounded">2nd</span>;
    return <span className="text-[10px] font-bold bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">3rd</span>;
  };

  const ratingBadge = (rating: number, raters: number) => {
    if (raters === 0) return <span className="text-[10px] text-neutral-600">No ratings</span>;
    const color = rating >= 4 ? 'text-green-400' : rating >= 3 ? 'text-blue-400' : rating >= 2 ? 'text-orange-400' : 'text-red-400';
    return <span className={`text-xs font-bold ${color}`}>{rating.toFixed(1)}</span>;
  };

  const groupBadge = (group: string) => {
    const colors = GROUP_COLORS[group];
    if (!colors) return null;
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
        {group}
      </span>
    );
  };

  const renderPlayerRow = (entry: DepthEntry, rank: number, compact?: boolean) => (
    <div key={`${entry.player.name}-${entry.positionType}`} className={`flex items-center gap-2 ${compact ? 'py-1' : 'py-1.5'}`}>
      <span className="text-neutral-600 text-xs w-4 text-right">{rank}.</span>
      <div className="w-7 h-7 rounded-full bg-neutral-800 overflow-hidden flex-shrink-0">
        {entry.photoUrl && (
          <img
            src={entry.photoUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium truncate ${rank === 1 ? 'text-white' : 'text-neutral-300'}`}>
            {entry.player.name}
          </span>
          {posTypeBadge(entry.positionType)}
          {groupBadge(entry.player.trainingGroup)}
        </div>
      </div>
      {ratingBadge(entry.rating, entry.totalRaters)}
    </div>
  );

  // Formation layout - visual rugby field positions
  const FORMATION_ROWS = [
    { positions: [1, 2, 3] as RugbyPosition[], label: 'Front Row' },
    { positions: [4, 5] as RugbyPosition[], label: 'Locks' },
    { positions: [6, 7, 8] as RugbyPosition[], label: 'Back Row' },
    { positions: [9] as RugbyPosition[], label: 'Halfback' },
    { positions: [10] as RugbyPosition[], label: 'First Five' },
    { positions: [12, 13] as RugbyPosition[], label: 'Centers' },
    { positions: [11, 14] as RugbyPosition[], label: 'Wings' },
    { positions: [15] as RugbyPosition[], label: 'Fullback' },
  ];

  const renderFormationCard = (pos: RugbyPosition) => {
    const entries = depthByPosition[pos] || [];
    const starter = entries[0];
    const backups = entries.slice(1);
    const isExpanded = expandedPosition === pos;

    return (
      <div
        key={pos}
        className={`rounded-lg border transition-all cursor-pointer ${
          isExpanded
            ? 'bg-neutral-800 border-amber-500/50'
            : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
        }`}
        onClick={() => setExpandedPosition(isExpanded ? null : pos)}
        style={{ minWidth: 0 }}
      >
        {/* Position header */}
        <div className="px-2.5 pt-2 pb-1">
          <div className="flex items-center justify-between">
            <span className="text-amber-500 font-black text-lg leading-none">{pos}</span>
            <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">{POSITION_SHORT[pos]}</span>
          </div>
          <div className="text-[10px] text-neutral-600 mb-1">{POSITION_NAMES[pos]}</div>
        </div>

        {/* Starter */}
        {starter ? (
          <div className="px-2.5 pb-2">
            <div className="text-sm font-bold text-white truncate">{starter.player.name}</div>
            <div className="flex items-center gap-1.5 mt-1">
              {ratingBadge(starter.rating, starter.totalRaters)}
              {groupBadge(starter.player.trainingGroup)}
            </div>
          </div>
        ) : (
          <div className="px-2.5 pb-2 text-[10px] text-neutral-600 italic">No players</div>
        )}

        {/* Backup count indicator */}
        {backups.length > 0 && (
          <div className={`border-t px-2.5 py-1 flex items-center justify-between ${
            isExpanded ? 'border-neutral-700' : 'border-neutral-800'
          }`}>
            <span className="text-[10px] text-neutral-500">+{backups.length} backup{backups.length > 1 ? 's' : ''}</span>
            {isExpanded ? <ChevronUp size={10} className="text-neutral-500" /> : <ChevronDown size={10} className="text-neutral-500" />}
          </div>
        )}

        {/* Expanded backup list */}
        {isExpanded && backups.length > 0 && (
          <div className="border-t border-neutral-700 px-2.5 py-1.5 space-y-1.5">
            {backups.map((entry, i) => (
              <div key={entry.player.name} className="py-0.5">
                <div className="text-xs text-neutral-300 font-medium">{i + 2}. {entry.player.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {posTypeBadge(entry.positionType)}
                  {ratingBadge(entry.rating, entry.totalRaters)}
                  {groupBadge(entry.player.trainingGroup)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('LANDING')}
          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-neutral-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-white tracking-tight">DEPTH CHART</h1>
          <p className="text-xs text-neutral-500">Ranked by coach ratings</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('formation')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'formation' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Field
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('pools')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'pools' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Pools
          </button>
          <button
            onClick={() => setViewMode('bestxv')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'bestxv' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Best XV
          </button>
        </div>
      </div>

      {/* Filters - hide for Best XV and Pools */}
      {viewMode !== 'bestxv' && viewMode !== 'pools' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrimaryOnly(!primaryOnly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              primaryOnly
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300'
            }`}
          >
            Primary only
          </button>
        </div>
      )}
      <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
        {([['1sts and 2nds', '1sts & 2nds'], ['Academy', 'Academy'], ['all', 'All']] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSquadFilter(value as typeof squadFilter)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              squadFilter === value ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {viewMode === 'pools' ? (
        /* Pools View - collapsed positional groups */
        <div className="space-y-4">
          {poolData.map(pool => (
            <div key={pool.label} className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{pool.label}</h3>
                  <span className="text-[10px] text-neutral-500">
                    {pool.positions.map(p => `${p}-${POSITION_SHORT[p]}`).join(', ')}
                  </span>
                </div>
                <span className="text-xs text-neutral-600">{pool.entries.length} players</span>
              </div>
              <div className="divide-y divide-neutral-800/50">
                {pool.entries.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-neutral-600 italic">No players</div>
                ) : pool.entries.map((entry, i) => (
                  <div key={entry.player.name} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-neutral-600 text-xs w-5 text-right font-medium">{i + 1}.</span>
                    <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden flex-shrink-0">
                      {entry.photoUrl && (
                        <img
                          src={entry.photoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{entry.player.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-neutral-500">{entry.assignedPos}-{POSITION_SHORT[entry.assignedPos]}</span>
                        {posTypeBadge(entry.positionType)}
                        {groupBadge(entry.player.trainingGroup)}
                      </div>
                    </div>
                    {ratingBadge(entry.rating, entry.totalRaters)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'bestxv' ? (
        /* Best XV View */
        <div className="space-y-3">
          <div className="bg-gradient-to-b from-amber-950/20 to-amber-900/5 rounded-xl border border-amber-500/20 p-3 space-y-3">
            <div className="text-center text-xs text-amber-500 font-bold uppercase tracking-widest mb-1">
              Best XV - All Positions Filled
            </div>

            {FORMATION_ROWS.map(row => (
              <div key={row.label}>
                <div className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1.5 font-medium">{row.label}</div>
                <div className={`grid gap-2 ${
                  row.positions.length === 1 ? 'grid-cols-1 max-w-[200px] mx-auto' :
                  row.positions.length === 2 ? 'grid-cols-2 max-w-[340px] mx-auto' :
                  'grid-cols-3'
                }`}>
                  {row.positions.map(pos => {
                    const entry = bestXV[pos];
                    return (
                      <div
                        key={pos}
                        className={`rounded-lg border ${
                          entry
                            ? entry.positionType === 'best'
                              ? 'bg-neutral-900 border-amber-500/30'
                              : entry.positionType === 'second'
                                ? 'bg-neutral-900 border-blue-500/30'
                                : 'bg-neutral-900 border-orange-500/30'
                            : 'bg-neutral-900 border-neutral-800'
                        }`}
                      >
                        <div className="px-2.5 pt-2 pb-1">
                          <div className="flex items-center justify-between">
                            <span className="text-amber-500 font-black text-lg leading-none">{pos}</span>
                            <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">{POSITION_SHORT[pos]}</span>
                          </div>
                          <div className="text-[10px] text-neutral-600 mb-1">{POSITION_NAMES[pos]}</div>
                        </div>
                        {entry ? (
                          <div className="px-2.5 pb-2">
                            <div className="text-sm font-bold text-white truncate">{entry.player.name}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {posTypeBadge(entry.positionType)}
                              {ratingBadge(entry.rating, entry.totalRaters)}
                              {groupBadge(entry.player.trainingGroup)}
                            </div>
                          </div>
                        ) : (
                          <div className="px-2.5 pb-2 text-[10px] text-neutral-600 italic">Unfilled</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-3 text-[10px] text-neutral-600 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-amber-500/30"></span> Playing 1st position
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-blue-500/30"></span> Playing 2nd position
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-orange-500/30"></span> Playing 3rd position
            </span>
          </div>

          {/* Summary */}
          {(() => {
            const filled = Object.keys(bestXV).length;
            const outOfPos = Object.values(bestXV).filter(e => e.positionType !== 'best').length;
            return (
              <div className="text-center text-xs text-neutral-500">
                {filled}/15 positions filled
                {outOfPos > 0 && <span className="text-orange-400 ml-2">{outOfPos} playing out of primary position</span>}
              </div>
            );
          })()}
        </div>
      ) : viewMode === 'formation' ? (
        /* Formation View - visual rugby field layout */
        <div className="space-y-3">
          {/* Field background */}
          <div className="bg-gradient-to-b from-green-950/30 to-green-900/10 rounded-xl border border-green-900/20 p-3 space-y-3">
            {FORMATION_ROWS.map(row => (
              <div key={row.label}>
                <div className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1.5 font-medium">{row.label}</div>
                <div className={`grid gap-2 ${
                  row.positions.length === 1 ? 'grid-cols-1 max-w-[200px] mx-auto' :
                  row.positions.length === 2 ? 'grid-cols-2 max-w-[340px] mx-auto' :
                  'grid-cols-3'
                }`}>
                  {row.positions.map(pos => renderFormationCard(pos))}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-neutral-600">
            <span className="flex items-center gap-1">
              <span className="bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded font-bold">1st</span> Best position
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-neutral-700 text-neutral-300 px-1 py-0.5 rounded font-bold">2nd</span> Secondary
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-neutral-800 text-neutral-500 px-1 py-0.5 rounded font-bold">3rd</span> Tertiary
            </span>
          </div>
        </div>
      ) : (
        /* List View - all positions in order */
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => setShowBackups(!showBackups)}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {showBackups ? 'Hide backups' : 'Show backups'}
            </button>
          </div>

          {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as RugbyPosition[]).map(pos => {
            const entries = depthByPosition[pos] || [];
            const displayed = showBackups ? entries : entries.filter(e => e.positionType === 'best');
            if (displayed.length === 0) return (
              <div key={pos} className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-500 font-black text-lg">{pos}</span>
                  <span className="text-sm font-medium text-neutral-400">{POSITION_NAMES[pos]}</span>
                </div>
                <div className="text-xs text-neutral-600 italic pl-6">No players assigned</div>
              </div>
            );

            return (
              <div key={pos} className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-500 font-black text-lg">{pos}</span>
                  <span className="text-sm font-medium text-neutral-400">{POSITION_NAMES[pos]}</span>
                  <span className="text-[10px] text-neutral-600 ml-auto">{entries.length} player{entries.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="pl-1">
                  {displayed.map((entry, i) => renderPlayerRow(entry, i + 1))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DepthChart;
