import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, Star, Activity, Merge, Check, Users, CheckCircle } from 'lucide-react';
import { AppView, Player, PlayerRating, InjuryRecord, RosterPlayer } from '../types';
import { db, mergeAccounts, MergeResult } from '../services/db';
import { loadRatings, invalidateRatingsCache } from '../services/ratingData';
import { loadInjuries } from '../services/injuryData';
import { getPhotoUrl, ROSTER_PLAYERS, GROUP_COLORS } from '../services/rosterData';
import { useAlumniNames } from '../hooks/useAlumniNames';
import { currentRatingsOnly } from '../services/classYears';
import RatingModal from './RatingModal';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

interface CoachSummary {
  id: string;
  name: string;
  email?: string;
  ratings: PlayerRating[];
  injuries: InjuryRecord[];
}

type DetailTab = 'ratings' | 'injuries';

const STATUS_COLORS: Record<string, string> = {
  'Day to Day': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Questionable': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'IR / Out': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Returned to Play': 'bg-green-500/20 text-green-400 border-green-500/30',
};

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

const CoachActivity: React.FC<Props> = ({ onNavigate, currentPlayer }) => {
  const { alumniNames, isAlumniName, ready: alumniReady } = useAlumniNames(); // alumni are out of every list and number here
  const [coaches, setCoaches] = useState<Player[]>([]);
  const [allRatings, setAllRatings] = useState<PlayerRating[]>([]);
  const [allInjuries, setAllInjuries] = useState<InjuryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('ratings');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [mergeGroup, setMergeGroup] = useState<Player[] | null>(null);
  const [selectedKeepId, setSelectedKeepId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [unratedExpanded, setUnratedExpanded] = useState(false);
  const [ratingPlayer, setRatingPlayer] = useState<RosterPlayer | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [players, ratings, injuries] = await Promise.all([
        db.getPlayers(),
        loadRatings(),
        loadInjuries(),
      ]);
      setCoaches(players.filter(p => p.role === 'Coach' && !p.mergedInto));
      setAllRatings(ratings);
      setAllInjuries(injuries);
    } catch (error) {
      console.error('[CoachesCorner] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group ratings by raterId
  // Only ratings of current players count; alumni are out of every number here.
  const currentRatings = useMemo(
    () => currentRatingsOnly(allRatings, alumniNames),
    [allRatings, alumniNames],
  );

  const ratingsByRater = useMemo(() => {
    const map = new Map<string, PlayerRating[]>();
    for (const r of currentRatings) {
      const existing = map.get(r.raterId) || [];
      existing.push(r);
      map.set(r.raterId, existing);
    }
    return map;
  }, [currentRatings]);

  // Group injuries by coachSubmitting (case-insensitive)
  const injuriesByCoach = useMemo(() => {
    const map = new Map<string, InjuryRecord[]>();
    for (const inj of allInjuries) {
      const key = normalizeName(inj.coachSubmitting);
      const existing = map.get(key) || [];
      existing.push(inj);
      map.set(key, existing);
    }
    return map;
  }, [allInjuries]);

  // Build coach summaries
  const coachSummaries = useMemo((): CoachSummary[] => {
    return coaches.map(coach => {
      const ratings = ratingsByRater.get(coach.id) || [];
      const injuries = injuriesByCoach.get(normalizeName(coach.name)) || [];
      return {
        id: coach.id,
        name: coach.name,
        email: coach.email,
        ratings,
        injuries,
      };
    }).sort((a, b) => {
      const aActivity = a.ratings.length + a.injuries.length;
      const bActivity = b.ratings.length + b.injuries.length;
      if (bActivity !== aActivity) return bActivity - aActivity;
      return a.name.localeCompare(b.name);
    });
  }, [coaches, ratingsByRater, injuriesByCoach]);

  // Detect duplicates: group coaches by normalized name, flag groups > 1
  const duplicateGroups = useMemo(() => {
    const nameMap = new Map<string, Player[]>();
    for (const coach of coaches) {
      const key = normalizeName(coach.name);
      const existing = nameMap.get(key) || [];
      existing.push(coach);
      nameMap.set(key, existing);
    }
    const dupes: Map<string, Player[]> = new Map();
    for (const [key, group] of nameMap) {
      if (group.length > 1) dupes.set(key, group);
    }
    return dupes;
  }, [coaches]);

  // Players the current coach hasn't rated yet
  const unratedPlayers = useMemo(() => {
    if (!currentPlayer || !alumniReady) return { groups: new Map<string, typeof ROSTER_PLAYERS>(), total: 0 };
    const myRatings = ratingsByRater.get(currentPlayer.id) || [];
    const ratedNames = new Set(myRatings.map(r => r.playerName));
    const unrated = ROSTER_PLAYERS.filter(p => !ratedNames.has(p.name) && !isAlumniName(p.name));
    const groups = new Map<string, typeof ROSTER_PLAYERS>();
    for (const p of unrated) {
      const group = p.trainingGroup;
      const existing = groups.get(group) || [];
      existing.push(p);
      groups.set(group, existing);
    }
    return { groups, total: unrated.length };
  }, [currentPlayer, ratingsByRater, alumniNames, alumniReady]);

  const isDuplicate = (coachId: string): boolean => {
    for (const group of duplicateGroups.values()) {
      if (group.some(c => c.id === coachId)) return true;
    }
    return false;
  };

  const handleStartMerge = (group: Player[]) => {
    if (!currentPlayer) return;
    if (!group.some(c => c.id === currentPlayer.id)) return;
    setMergeGroup(group);
    setSelectedKeepId(null);
    setMergeResult(null);
    setMergeError(null);
  };

  const handleConfirmMerge = async () => {
    if (!mergeGroup || !selectedKeepId || !currentPlayer) return;
    const keepAccount = mergeGroup.find(c => c.id === selectedKeepId)!;
    const removeAccount = mergeGroup.find(c => c.id === currentPlayer.id)!;
    setIsMerging(true);
    setMergeError(null);
    try {
      const result = await mergeAccounts(keepAccount, removeAccount);
      setMergeResult(result);
      invalidateRatingsCache();
      setTimeout(async () => {
        setMergeGroup(null);
        setSelectedKeepId(null);
        setMergeResult(null);
        setIsMerging(false);
        await loadData();
      }, 2500);
    } catch (e: any) {
      console.error('[CoachesCorner] Merge failed:', e);
      setMergeError(e.message || 'Merge failed. Please try again.');
      setIsMerging(false);
    }
  };

  const handleCancelMerge = () => {
    setMergeGroup(null);
    setSelectedKeepId(null);
    setMergeResult(null);
    setMergeError(null);
  };

  const handleRatingSaved = useCallback(async () => {
    invalidateRatingsCache();
    const ratings = await loadRatings();
    setAllRatings(ratings);
    setRatingPlayer(null);
  }, []);

  const handleImageError = (name: string) => {
    setImageErrors(prev => new Set(prev).add(name));
  };

  const handleToggleExpand = (coachId: string) => {
    if (expandedCoachId === coachId) {
      setExpandedCoachId(null);
    } else {
      setExpandedCoachId(coachId);
      setDetailTab('ratings');
    }
  };

  const renderAvgScore = (ratings: PlayerRating[]): string => {
    if (ratings.length === 0) return '-';
    const allScores = ratings.flatMap(r => Object.values(r.ratings));
    const avg = allScores.reduce((sum, v) => sum + v, 0) / allScores.length;
    return avg.toFixed(1);
  };

  const renderCoachCard = (summary: CoachSummary) => {
    const isExpanded = expandedCoachId === summary.id;
    const photoUrl = getPhotoUrl(summary.name);
    const hasImageError = imageErrors.has(summary.name);
    const hasDupe = isDuplicate(summary.id);

    return (
      <div key={summary.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {/* Summary row */}
        <button
          onClick={() => handleToggleExpand(summary.id)}
          className="w-full flex items-center gap-3 p-4 hover:bg-neutral-800/50 transition-colors"
        >
          {/* Photo */}
          <div className="w-10 h-10 rounded-full bg-neutral-800 flex-shrink-0 overflow-hidden">
            {!hasImageError && photoUrl ? (
              <img
                src={photoUrl}
                alt={summary.name}
                className="w-full h-full object-cover"
                onError={() => handleImageError(summary.name)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-500 text-sm font-bold">
                {summary.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
          </div>

          {/* Name + email */}
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold truncate">{summary.name}</span>
              {hasDupe && (
                <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
              )}
            </div>
            {summary.email && (
              <div className="text-neutral-500 text-xs truncate">{summary.email}</div>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Star size={10} />
              {summary.ratings.length}
            </span>
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
              <Activity size={10} />
              {summary.injuries.length}
            </span>
          </div>

          {/* Expand toggle */}
          {isExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
        </button>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="border-t border-neutral-800">
            {/* Sub-tabs */}
            <div className="flex border-b border-neutral-800">
              <button
                onClick={() => setDetailTab('ratings')}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                  detailTab === 'ratings'
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Ratings ({summary.ratings.length})
              </button>
              <button
                onClick={() => setDetailTab('injuries')}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                  detailTab === 'injuries'
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Injuries ({summary.injuries.length})
              </button>
            </div>

            <div className="p-3 max-h-64 overflow-y-auto">
              {detailTab === 'ratings' ? renderRatingsDetail(summary) : renderInjuriesDetail(summary)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRatingsDetail = (summary: CoachSummary) => {
    if (summary.ratings.length === 0) {
      return <div className="text-neutral-500 text-xs text-center py-4">No ratings submitted</div>;
    }

    // Group by player, compute average
    const byPlayer = new Map<string, PlayerRating[]>();
    for (const r of summary.ratings) {
      const existing = byPlayer.get(r.playerName) || [];
      existing.push(r);
      byPlayer.set(r.playerName, existing);
    }

    const playerEntries = Array.from(byPlayer.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <div className="space-y-2">
        {playerEntries.map(([playerName, ratings]) => {
          const latestRating = ratings.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          const scores = Object.values(latestRating.ratings);
          const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
          return (
            <div key={playerName} className="flex items-center justify-between py-1.5 px-2 rounded bg-neutral-800/50">
              <span className="text-neutral-200 text-sm truncate">{playerName}</span>
              <div className="flex items-center gap-3 text-xs flex-shrink-0">
                <span className="text-amber-400 font-semibold">{avg.toFixed(1)}</span>
                <span className="text-neutral-500">
                  {new Date(latestRating.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderInjuriesDetail = (summary: CoachSummary) => {
    if (summary.injuries.length === 0) {
      return <div className="text-neutral-500 text-xs text-center py-4">No injuries logged</div>;
    }

    const sorted = [...summary.injuries].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return (
      <div className="space-y-2">
        {sorted.map(injury => (
          <div key={injury.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-neutral-800/50">
            <div className="min-w-0">
              <span className="text-neutral-200 text-sm truncate block">{injury.playerName}</span>
              <span className="text-neutral-500 text-xs">
                {(injury.bodyPart || []).join(', ')}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[injury.currentStatus] || 'text-neutral-400'}`}>
                {injury.currentStatus}
              </span>
              <span className="text-neutral-500 text-xs">
                {injury.dateOfInjury && injury.dateOfInjury !== 'TBD'
                  ? new Date(injury.dateOfInjury).toLocaleDateString()
                  : injury.updatedAt
                    ? new Date(injury.updatedAt).toLocaleDateString()
                    : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderUnratedSection = () => {
    if (!currentPlayer) return null;

    if (unratedPlayers.total === 0) {
      return (
        <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
          <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
          <span className="text-green-400 text-sm font-semibold">All players rated</span>
        </div>
      );
    }

    const groupOrder = ['Black', 'Gold', 'Silver', 'Bronze'];

    return (
      <div className="mb-6 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setUnratedExpanded(!unratedExpanded)}
          className="w-full flex items-center gap-3 p-4 hover:bg-neutral-800/50 transition-colors"
        >
          <Users size={18} className="text-neutral-400 flex-shrink-0" />
          <span className="text-white font-semibold text-sm flex-1 text-left">Not Yet Rated</span>
          <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold">
            {unratedPlayers.total}
          </span>
          {unratedExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
        </button>

        {unratedExpanded && (
          <div className="border-t border-neutral-800 p-3 max-h-80 overflow-y-auto">
            <div className="space-y-3">
              {groupOrder.map(group => {
                const players = unratedPlayers.groups.get(group);
                if (!players || players.length === 0) return null;
                const colors = GROUP_COLORS[group];
                return (
                  <div key={group}>
                    <div className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${colors.bg} ${colors.text} mb-1.5`}>
                      {group} ({players.length})
                    </div>
                    <div className="space-y-1">
                      {players.map(p => (
                        <button
                          key={p.name}
                          onClick={() => setRatingPlayer(p)}
                          className="w-full flex items-center justify-between py-1.5 px-2 rounded bg-neutral-800/50 hover:bg-neutral-700/50 transition-colors text-left"
                        >
                          <span className="text-neutral-200 text-sm truncate">{p.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-neutral-500 text-xs">{p.squad}</span>
                            <Star size={12} className="text-amber-500/60" />
                          </div>
                        </button>
                      ))}
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[85vh]">
        <div className="text-neutral-400">Loading coaches...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate('LANDING')}
          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-neutral-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Coaches Corner</h1>
          <p className="text-neutral-500 text-xs">
            {coaches.length} coaches &middot; {currentRatings.length} ratings &middot; {allInjuries.length} injuries
          </p>
        </div>
      </div>

      {/* Duplicate warning banner */}
      {duplicateGroups.size > 0 && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-semibold mb-1">
            <AlertTriangle size={16} />
            Duplicate accounts detected
          </div>
          {Array.from(duplicateGroups.entries()).map(([, group]) => {
            const isMyGroup = currentPlayer && group.some(c => c.id === currentPlayer.id);
            return (
              <div key={group[0].id} className="flex items-center justify-between ml-6 mt-1">
                <div className="text-yellow-300/80 text-xs">
                  &quot;{group[0].name}&quot; has {group.length} accounts
                  {group.some(c => c.email) && (
                    <span className="text-yellow-500/60">
                      {' '}({group.map(c => c.email || 'no email').join(', ')})
                    </span>
                  )}
                </div>
                {isMyGroup && (
                  <button
                    onClick={() => handleStartMerge(group)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors flex-shrink-0 ml-2"
                  >
                    <Merge size={12} />
                    Merge
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{coaches.length}</div>
          <div className="text-neutral-500 text-xs">Coaches</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{currentRatings.length}</div>
          <div className="text-neutral-500 text-xs">Ratings</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-400">{allInjuries.length}</div>
          <div className="text-neutral-500 text-xs">Injuries</div>
        </div>
      </div>

      {/* Not yet rated section */}
      {renderUnratedSection()}

      {/* Avg score across all coach ratings */}
      <div className="text-neutral-500 text-xs mb-3 px-1">
        Avg rating given: <span className="text-amber-400 font-semibold">{renderAvgScore(currentRatings)}</span>
      </div>

      {/* Coach cards */}
      <div className="space-y-3">
        {coachSummaries.length === 0 ? (
          <div className="text-neutral-500 text-center py-12">No coaches found</div>
        ) : (
          coachSummaries.map(renderCoachCard)
        )}
      </div>

      {/* Merge confirmation modal */}
      {mergeGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-yellow-500/10 border-b border-yellow-500/30 p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-white font-bold">Merge Your Accounts</h2>
                <p className="text-yellow-300/80 text-sm mt-1">
                  Your current login will be merged into the account you select below.
                </p>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {mergeResult ? (
                <div className="text-center py-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                    <Star size={20} className="text-green-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">Merge Complete</h3>
                  <div className="text-neutral-400 text-sm space-y-1">
                    {mergeResult.ratingsReattributed > 0 && (
                      <p>{mergeResult.ratingsReattributed} rating{mergeResult.ratingsReattributed !== 1 ? 's' : ''} transferred</p>
                    )}
                    {mergeResult.ratingsDeduplicated > 0 && (
                      <p>{mergeResult.ratingsDeduplicated} duplicate{mergeResult.ratingsDeduplicated !== 1 ? 's' : ''} consolidated</p>
                    )}
                    {mergeResult.historyReattributed > 0 && (
                      <p>{mergeResult.historyReattributed} history entr{mergeResult.historyReattributed !== 1 ? 'ies' : 'y'} updated</p>
                    )}
                    {mergeResult.injuriesUpdated > 0 && (
                      <p>{mergeResult.injuriesUpdated} injur{mergeResult.injuriesUpdated !== 1 ? 'ies' : 'y'} record updated</p>
                    )}
                    {mergeResult.ratingsReattributed === 0 && mergeResult.ratingsDeduplicated === 0 &&
                      mergeResult.historyReattributed === 0 && mergeResult.injuriesUpdated === 0 && (
                      <p>No data needed to be transferred</p>
                    )}
                  </div>
                  <p className="text-neutral-500 text-xs mt-3">Reloading...</p>
                </div>
              ) : (
                <>
                  {/* Current account — always the one being merged away */}
                  {currentPlayer && (
                    <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-3">
                      <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1">This login (will be merged away)</div>
                      <div className="text-white font-semibold text-sm">{currentPlayer.name}</div>
                      <div className="text-neutral-400 text-xs">{currentPlayer.email || 'No email'}</div>
                      <div className="text-neutral-500 text-xs mt-1">
                        {(ratingsByRater.get(currentPlayer.id) || []).length} rating{(ratingsByRater.get(currentPlayer.id) || []).length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-center text-neutral-500 text-xs py-1">
                    merge into
                  </div>

                  <p className="text-neutral-400 text-xs">Select which account to keep:</p>
                  {mergeGroup.filter(acct => !currentPlayer || acct.id !== currentPlayer.id).map(acct => {
                    const count = (ratingsByRater.get(acct.id) || []).length;
                    const isSelected = selectedKeepId === acct.id;
                    return (
                      <button
                        key={acct.id}
                        onClick={() => setSelectedKeepId(acct.id)}
                        disabled={isMerging}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                            : 'bg-neutral-800/50 border-neutral-700/50 hover:border-neutral-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-semibold text-sm">{acct.name}</div>
                            <div className="text-neutral-400 text-xs mt-0.5">{acct.email || 'No email'}</div>
                            <div className="text-neutral-500 text-xs mt-1">{count} rating{count !== 1 ? 's' : ''}</div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500'
                              : 'border-neutral-600'
                          }`}>
                            {isSelected && <Check size={12} className="text-black" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {mergeError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                      {mergeError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleCancelMerge}
                      disabled={isMerging}
                      className="flex-1 py-3 px-4 rounded-lg text-sm font-semibold text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmMerge}
                      disabled={isMerging || !selectedKeepId}
                      className="flex-1 py-3 px-4 rounded-lg text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:bg-neutral-700 disabled:text-neutral-500 flex items-center justify-center gap-2"
                    >
                      {isMerging ? (
                        <>
                          <Merge size={16} className="animate-spin" />
                          Merging...
                        </>
                      ) : (
                        <>
                          <Merge size={16} />
                          Merge
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rating modal */}
      {ratingPlayer && currentPlayer && (
        <RatingModal
          isOpen={true}
          onClose={() => setRatingPlayer(null)}
          onSave={handleRatingSaved}
          player={ratingPlayer}
          currentPlayer={currentPlayer}
        />
      )}
    </div>
  );
};

export default CoachActivity;
