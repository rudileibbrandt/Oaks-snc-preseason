import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trash2, AlertTriangle, CheckCircle, Shield, User, RefreshCw, ArrowRightLeft, Search, Undo2, GraduationCap } from 'lucide-react';
import { isAlumni, defaultAlumniClass } from '../services/alumni';
import { setRosterAlumni } from '../services/classYears';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { normalizeName } from '../services/alumni';
import { Player, PlayerRating } from '../types';
import { db, manualMigrateTo5PointScale, restoreRatingsFromHistory, clearMergedInto } from '../services/db';
import { invalidateRatingsCache, deleteRating, deleteRatingsByRater, RATING_COLORS, calculateAverageRating } from '../services/ratingData';

interface Props {
  allRatings: PlayerRating[];
  onRatingsDeleted: () => void;
}

const AdminPanel: React.FC<Props> = ({ allRatings, onRatingsDeleted }) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [selectedRatingId, setSelectedRatingId] = useState<string>('');
  const [selectedRaterId, setSelectedRaterId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSingleDelete, setConfirmSingleDelete] = useState(false);
  const [confirmRaterDelete, setConfirmRaterDelete] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeSection, setActiveSection] = useState<'users' | 'restore' | 'single' | 'by-rater' | 'all'>('users');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<{ success: boolean; message: string } | null>(null);

  // User management state
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);
  const [allRosterPlayers, setAllRosterPlayers] = useState<Player[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleChangeResult, setRoleChangeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  // Alumni state: which player's class-year picker is open, and the year chosen
  const [alumniPickId, setAlumniPickId] = useState<string | null>(null);
  const [alumniYear, setAlumniYear] = useState<number>(defaultAlumniClass());
  const [savingAlumniId, setSavingAlumniId] = useState<string | null>(null);

  // Restore state
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
  const [unmergeId, setUnmergeId] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setIsLoadingRoster(true);
    try {
      const players = await db.getPlayers();
      setAllRosterPlayers(players);
      setRosterPlayers(players.filter(p => !p.mergedInto));
    } catch (error) {
      console.error('[AdminPanel] Error loading roster:', error);
    } finally {
      setIsLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Get unique player names with rating counts
  const playersWithRatings = useMemo(() => {
    const playerMap = new Map<string, number>();
    allRatings.forEach(r => {
      const count = playerMap.get(r.playerName) || 0;
      playerMap.set(r.playerName, count + 1);
    });
    return Array.from(playerMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allRatings]);

  const selectedPlayerCount = playersWithRatings.find(p => p.name === selectedPlayer)?.count || 0;

  // Get unique raters with rating counts
  const ratersWithRatings = useMemo(() => {
    const raterMap = new Map<string, { id: string; name: string; count: number }>();
    allRatings.forEach(r => {
      const existing = raterMap.get(r.raterId);
      if (existing) {
        existing.count += 1;
      } else {
        raterMap.set(r.raterId, { id: r.raterId, name: r.raterName, count: 1 });
      }
    });
    return Array.from(raterMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRatings]);

  const selectedRaterInfo = ratersWithRatings.find(r => r.id === selectedRaterId);

  // Count feedback still on old 1-3 scale
  const oldScaleCount = useMemo(() => {
    return allRatings.filter(r => {
      const values = Object.values(r.ratings).filter(v => v !== undefined && v >= 1);
      return values.length > 0 && values.every(v => (v as number) <= 3);
    }).length;
  }, [allRatings]);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setMigrateResult(null);
    try {
      const { ratingsCount, historyCount } = await manualMigrateTo5PointScale();
      invalidateRatingsCache();
      setMigrateResult({
        success: true,
        message: `Migrated ${ratingsCount} feedback record${ratingsCount !== 1 ? 's' : ''} and ${historyCount} history entr${historyCount !== 1 ? 'ies' : 'y'} (1→2, 2→3, 3→4)`,
      });
      onRatingsDeleted(); // triggers reload of all ratings in parent
    } catch (error) {
      console.error('[AdminPanel] Migration error:', error);
      setMigrateResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // Get ratings for selected player (for single delete)
  const ratingsForSelectedPlayer = useMemo(() => {
    if (!selectedPlayer) return [];
    return allRatings
      .filter(r => r.playerName.toLowerCase().trim() === selectedPlayer.toLowerCase().trim())
      .sort((a, b) => a.raterName.localeCompare(b.raterName));
  }, [allRatings, selectedPlayer]);

  // Get selected rating details
  const selectedRating = useMemo(() => {
    if (!selectedRatingId) return null;
    return ratingsForSelectedPlayer.find(r => r.id === selectedRatingId) || null;
  }, [ratingsForSelectedPlayer, selectedRatingId]);

  const handleDeleteSingle = async () => {
    if (!selectedRatingId || !confirmSingleDelete) return;

    setIsDeleting(true);
    setResult(null);

    try {
      const success = await deleteRating(selectedRatingId);
      if (success) {
        setResult({
          success: true,
          message: `Deleted rating by ${selectedRating?.raterName} for ${selectedPlayer}`,
        });
        setSelectedRatingId('');
        setConfirmSingleDelete(false);
        onRatingsDeleted();
      } else {
        setResult({
          success: false,
          message: 'Rating not found',
        });
      }
    } catch (error) {
      console.error('[AdminPanel] Delete single rating error:', error);
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlayer || !confirmDelete) return;

    setIsDeleting(true);
    setResult(null);

    try {
      const deleted = await db.deleteRatingsForPlayer(selectedPlayer);
      invalidateRatingsCache();
      setResult({
        success: true,
        message: `Deleted ${deleted} rating(s) for ${selectedPlayer}`,
      });
      setSelectedPlayer('');
      setConfirmDelete(false);
      onRatingsDeleted();
    } catch (error) {
      console.error('[AdminPanel] Delete error:', error);
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteByRater = async () => {
    if (!selectedRaterId || !confirmRaterDelete) return;

    setIsDeleting(true);
    setResult(null);

    try {
      const deleted = await deleteRatingsByRater(selectedRaterId);
      setResult({
        success: true,
        message: `Deleted ${deleted} rating(s) by ${selectedRaterInfo?.name}`,
      });
      setSelectedRaterId('');
      setConfirmRaterDelete(false);
      onRatingsDeleted();
    } catch (error) {
      console.error('[AdminPanel] Delete by rater error:', error);
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRoleChange = async (player: Player) => {
    const newRole = player.role === 'Coach' ? 'Player' : 'Coach';
    setChangingRoleId(player.id);
    setRoleChangeResult(null);
    try {
      await db.updatePlayerRole(player.id, newRole);
      setRoleChangeResult({
        success: true,
        message: `Changed ${player.name} from ${player.role} to ${newRole}`,
      });
      await loadRoster();
    } catch (error) {
      console.error('[AdminPanel] Role change error:', error);
      setRoleChangeResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setChangingRoleId(null);
    }
  };

  // Move a player to alumni (classYear) or back to the current team (null).
  const handleSetAlumni = async (player: Player, classYear: number | null) => {
    setSavingAlumniId(player.id);
    setRoleChangeResult(null);
    try {
      await setRosterAlumni(player.name, player, classYear);
      setRoleChangeResult({
        success: true,
        message: classYear === null
          ? `Moved ${player.name} back to the current team`
          : `Moved ${player.name} to Alumni (Class of ${classYear})` + (
            ROSTER_PLAYERS.some(rp => normalizeName(rp.name) === normalizeName(player.name)) ? '' :
            `. Note: no roster player is named "${player.name}", so ratings or the depth chart may list them under another name. Graduate them in Player Roster > Graduate Seniors too.`
          ),
      });
      setAlumniPickId(null);
      await loadRoster();
    } catch (error) {
      console.error('[AdminPanel] Alumni change error:', error);
      setRoleChangeResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setSavingAlumniId(null);
    }
  };

  const filteredRoster = useMemo(() => {
    const sorted = [...rosterPlayers].sort((a, b) => {
      if (a.role !== b.role) return a.role === 'Coach' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (!userSearch.trim()) return sorted;
    const q = userSearch.toLowerCase();
    return sorted.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  }, [rosterPlayers, userSearch]);

  const mergedPlayers = useMemo(() => {
    return allRosterPlayers.filter(p => p.mergedInto);
  }, [allRosterPlayers]);

  const handleRestore = async (player: Player) => {
    setIsRestoring(true);
    setRestoreResult(null);
    try {
      // Find all account IDs for this name (merged + active)
      const norm = player.name.toLowerCase().trim();
      const relatedIds = allRosterPlayers
        .filter(p => p.name.toLowerCase().trim() === norm)
        .map(p => p.id);

      const res = await restoreRatingsFromHistory(relatedIds);
      invalidateRatingsCache();
      setRestoreResult({
        success: true,
        message: `Restored ${res.ratingsRestored} rating${res.ratingsRestored !== 1 ? 's' : ''} for ${player.name}${res.ratingsSkipped > 0 ? ` (${res.ratingsSkipped} already existed)` : ''}`,
      });
      onRatingsDeleted(); // triggers parent reload
    } catch (error) {
      console.error('[AdminPanel] Restore error:', error);
      setRestoreResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleUnmerge = async (playerId: string) => {
    setUnmergeId(playerId);
    try {
      await clearMergedInto(playerId);
      await loadRoster();
      setRestoreResult({
        success: true,
        message: 'Account unmerged successfully',
      });
    } catch (error) {
      console.error('[AdminPanel] Unmerge error:', error);
      setRestoreResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setUnmergeId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-400 mb-1">Admin Zone</h3>
            <p className="text-xs text-neutral-400">
              Actions here permanently delete data. Use with caution.
            </p>
          </div>
        </div>
      </div>

      {/* Migrate Old Scale */}
      <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white">Migrate Old 1-3 Scale</h3>
        </div>
        <p className="text-xs text-neutral-400 mb-1">
          Converts old 3-tier scores to the 5-tier scale: <span className="text-white">1→2, 2→3, 3→4</span>
        </p>
        <p className="text-xs text-neutral-500 mb-3">
          Only affects records where all values are 1-3. Already-migrated data is skipped.
        </p>

        {oldScaleCount > 0 ? (
          <p className="text-xs text-amber-400 mb-3">
            {oldScaleCount} feedback record{oldScaleCount !== 1 ? 's' : ''} still on old scale
          </p>
        ) : (
          <p className="text-xs text-green-400 mb-3">
            All feedback is already on the 5-point scale
          </p>
        )}

        <button
          onClick={handleMigrate}
          disabled={isMigrating || oldScaleCount === 0}
          className={`w-full p-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
            isMigrating || oldScaleCount === 0
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-black'
          }`}
        >
          {isMigrating ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Migrating...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Migrate to 5-Point Scale
            </>
          )}
        </button>

        {migrateResult && (
          <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
            migrateResult.success
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {migrateResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span className="text-sm">{migrateResult.message}</span>
          </div>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex border border-neutral-800 rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setActiveSection('users');
            setResult(null);
            setRoleChangeResult(null);
          }}
          className={`flex-1 py-2 px-2 text-xs font-medium transition-colors ${
            activeSection === 'users'
              ? 'bg-blue-500 text-white'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <ArrowRightLeft size={12} className="inline mr-1" />
          Users
        </button>
        <button
          onClick={() => {
            setActiveSection('restore');
            setResult(null);
            setRestoreResult(null);
          }}
          className={`flex-1 py-2 px-2 text-xs font-medium transition-colors ${
            activeSection === 'restore'
              ? 'bg-green-500 text-white'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <Undo2 size={12} className="inline mr-1" />
          Restore
        </button>
        <button
          onClick={() => {
            setActiveSection('single');
            setResult(null);
          }}
          className={`flex-1 py-2 px-2 text-xs font-medium transition-colors ${
            activeSection === 'single'
              ? 'bg-amber-500 text-black'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <User size={12} className="inline mr-1" />
          Single
        </button>
        <button
          onClick={() => {
            setActiveSection('by-rater');
            setResult(null);
          }}
          className={`flex-1 py-2 px-2 text-xs font-medium transition-colors ${
            activeSection === 'by-rater'
              ? 'bg-orange-500 text-white'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <User size={12} className="inline mr-1" />
          By Rater
        </button>
        <button
          onClick={() => {
            setActiveSection('all');
            setResult(null);
          }}
          className={`flex-1 py-2 px-2 text-xs font-medium transition-colors ${
            activeSection === 'all'
              ? 'bg-red-500 text-white'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          <Trash2 size={12} className="inline mr-1" />
          All Player
        </button>
      </div>

      {/* User Management Section */}
      {activeSection === 'users' && (
        <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-blue-400" />
            User Management
          </h3>
          <p className="text-xs text-neutral-400 mb-4">
            Change user roles between Coach and Player. This affects what views and permissions they have.
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 placeholder-neutral-500"
            />
          </div>

          {roleChangeResult && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              roleChangeResult.success
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {roleChangeResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span className="text-sm">{roleChangeResult.message}</span>
            </div>
          )}

          {isLoadingRoster ? (
            <div className="text-neutral-500 text-sm text-center py-8">Loading users...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredRoster.length === 0 ? (
                <div className="text-neutral-500 text-sm text-center py-4">No users found</div>
              ) : (
                filteredRoster.map(player => (
                  <div key={player.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-sm font-medium truncate">{player.name}</div>
                      <div className="text-neutral-500 text-xs truncate">
                        {player.email || 'No email'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2 flex-wrap justify-end">
                      {player.role === 'Player' && (
                        isAlumni(player) ? (
                          <>
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-300 border-purple-500/30 flex items-center gap-1">
                              <GraduationCap size={10} />
                              Class of {player.alumniClass}
                            </span>
                            <button
                              onClick={() => handleSetAlumni(player, null)}
                              disabled={savingAlumniId === player.id}
                              className="text-xs px-2 py-1 rounded-md bg-neutral-700 text-neutral-300 hover:bg-neutral-600 hover:text-white transition-colors disabled:opacity-50"
                            >
                              {savingAlumniId === player.id ? 'Saving...' : 'Restore'}
                            </button>
                          </>
                        ) : alumniPickId === player.id ? (
                          <>
                            <select
                              value={alumniYear}
                              onChange={e => setAlumniYear(parseInt(e.target.value))}
                              className="text-xs px-1 py-1 rounded-md bg-black border border-neutral-700 text-white"
                            >
                              {Array.from({ length: 8 }, (_, i) => defaultAlumniClass() + 1 - i).map(y => (
                                <option key={y} value={y}>Class of {y}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSetAlumni(player, alumniYear)}
                              disabled={savingAlumniId === player.id}
                              className="text-xs px-2 py-1 rounded-md bg-purple-500/30 text-purple-200 border border-purple-500/40 hover:bg-purple-500/40 transition-colors disabled:opacity-50"
                            >
                              {savingAlumniId === player.id ? 'Saving...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setAlumniPickId(null)}
                              className="text-xs px-2 py-1 rounded-md text-neutral-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setAlumniYear(defaultAlumniClass()); setAlumniPickId(player.id); }}
                            className="text-xs px-2 py-1 rounded-md bg-neutral-700 text-neutral-300 hover:bg-neutral-600 hover:text-white transition-colors flex items-center gap-1"
                          >
                            <GraduationCap size={10} />
                            → Alumni
                          </button>
                        )
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        player.role === 'Coach'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }`}>
                        {player.role}
                      </span>
                      <button
                        onClick={() => handleRoleChange(player)}
                        disabled={changingRoleId === player.id}
                        className="text-xs px-2 py-1 rounded-md bg-neutral-700 text-neutral-300 hover:bg-neutral-600 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {changingRoleId === player.id ? (
                          <div className="w-3 h-3 border-2 border-neutral-400/30 border-t-neutral-400 rounded-full animate-spin" />
                        ) : (
                          <>
                            <ArrowRightLeft size={10} />
                            → {player.role === 'Coach' ? 'Player' : 'Coach'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mt-3 text-xs text-neutral-500">
            {rosterPlayers.filter(p => p.role === 'Coach').length} coaches, {rosterPlayers.filter(p => p.role === 'Player' && !isAlumni(p)).length} players, {rosterPlayers.filter(isAlumni).length} alumni
          </div>
        </div>
      )}

      {/* Restore Ratings Section */}
      {activeSection === 'restore' && (
        <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Undo2 size={16} className="text-green-400" />
            Restore Ratings from History
          </h3>
          <p className="text-xs text-neutral-400 mb-4">
            Rebuilds ratings from ratingHistory entries. Use this to recover ratings lost during a bad merge.
          </p>

          {restoreResult && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              restoreResult.success
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {restoreResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span className="text-sm">{restoreResult.message}</span>
            </div>
          )}

          {/* Merged accounts section */}
          {mergedPlayers.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Merged Accounts</h4>
              <div className="space-y-2">
                {mergedPlayers.map(player => (
                  <div key={player.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-sm font-medium truncate">{player.name}</div>
                      <div className="text-neutral-500 text-xs truncate">{player.email || 'No email'}</div>
                      <div className="text-yellow-400/60 text-xs">merged into {player.mergedInto}</div>
                    </div>
                    <button
                      onClick={() => handleUnmerge(player.id)}
                      disabled={unmergeId === player.id}
                      className="text-xs px-2 py-1 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors disabled:opacity-50 flex-shrink-0 ml-2"
                    >
                      {unmergeId === player.id ? 'Unmerging...' : 'Unmerge'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Restore for all coaches */}
          <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Restore Ratings</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {rosterPlayers.filter(p => p.role === 'Coach').map(player => {
              const ratingCount = allRatings.filter(r => r.raterId === player.id).length;
              return (
                <div key={player.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-sm font-medium truncate">{player.name}</div>
                    <div className="text-neutral-500 text-xs">{ratingCount} current rating{ratingCount !== 1 ? 's' : ''}</div>
                  </div>
                  <button
                    onClick={() => handleRestore(player)}
                    disabled={isRestoring}
                    className="text-xs px-2 py-1 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 flex-shrink-0 ml-2"
                  >
                    {isRestoring ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Single Rating Section */}
      {activeSection === 'single' && (
        <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <User size={16} className="text-amber-400" />
            Delete Single Feedback
          </h3>

          {/* Player Select */}
          <div className="mb-4">
            <label className="block text-xs text-neutral-500 mb-2">Select Player</label>
            <select
              value={selectedPlayer}
              onChange={(e) => {
                setSelectedPlayer(e.target.value);
                setSelectedRatingId('');
                setConfirmSingleDelete(false);
                setResult(null);
              }}
              className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">-- Select a player --</option>
              {playersWithRatings.map(({ name, count }) => (
                <option key={name} value={name}>
                  {name} ({count} feedback{count !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Rater Select */}
          {selectedPlayer && ratingsForSelectedPlayer.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs text-neutral-500 mb-2">Select Rater</label>
              <div className="space-y-2">
                {ratingsForSelectedPlayer.map(rating => {
                  const avgRating = calculateAverageRating(rating.ratings);
                  const isSelected = selectedRatingId === rating.id;
                  return (
                    <button
                      key={rating.id}
                      onClick={() => {
                        setSelectedRatingId(rating.id);
                        setConfirmSingleDelete(false);
                        setResult(null);
                      }}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500/50'
                          : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`font-medium ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                            {rating.raterName}
                          </span>
                          <span className="text-xs text-neutral-500 ml-2">
                            {new Date(rating.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                          RATING_COLORS[Math.round(avgRating)]?.bg || 'bg-neutral-700'
                        } ${RATING_COLORS[Math.round(avgRating)]?.text || 'text-neutral-400'}`}>
                          {avgRating.toFixed(1)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirmation */}
          {selectedRating && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">
                    Delete feedback by {selectedRating.raterName}?
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    This will permanently remove this feedback and its history.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmSingleDelete}
                  onChange={(e) => setConfirmSingleDelete(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-red-500 focus:ring-red-500"
                />
                <span className="text-sm text-neutral-300">I understand this cannot be undone</span>
              </label>
            </div>
          )}

          {/* Delete Button */}
          <button
            onClick={handleDeleteSingle}
            disabled={!selectedRatingId || !confirmSingleDelete || isDeleting}
            className={`w-full p-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              !selectedRatingId || !confirmSingleDelete || isDeleting
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete Feedback
              </>
            )}
          </button>

          {/* Result Message */}
          {result && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              result.success
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {result.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span className="text-sm">{result.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Delete By Rater Section */}
      {activeSection === 'by-rater' && (
        <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <User size={16} className="text-orange-400" />
            Delete All Feedback by Rater
          </h3>

          {/* Rater Select */}
          <div className="mb-4">
            <label className="block text-xs text-neutral-500 mb-2">Select Rater</label>
            <select
              value={selectedRaterId}
              onChange={(e) => {
                setSelectedRaterId(e.target.value);
                setConfirmRaterDelete(false);
                setResult(null);
              }}
              className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">-- Select a rater --</option>
              {ratersWithRatings.map(({ id, name, count }) => (
                <option key={id} value={id}>
                  {name} ({count} feedback{count !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Confirmation */}
          {selectedRaterInfo && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">
                    Delete all {selectedRaterInfo.count} feedback(s) by {selectedRaterInfo.name}?
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    This will permanently remove all feedback submitted by this person.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmRaterDelete}
                  onChange={(e) => setConfirmRaterDelete(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-red-500 focus:ring-red-500"
                />
                <span className="text-sm text-neutral-300">I understand this cannot be undone</span>
              </label>
            </div>
          )}

          {/* Delete Button */}
          <button
            onClick={handleDeleteByRater}
            disabled={!selectedRaterId || !confirmRaterDelete || isDeleting}
            className={`w-full p-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              !selectedRaterId || !confirmRaterDelete || isDeleting
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete All by Rater
              </>
            )}
          </button>

          {/* Result Message */}
          {result && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              result.success
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {result.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span className="text-sm">{result.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Delete All Ratings Section */}
      {activeSection === 'all' && (
        <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Trash2 size={16} className="text-red-400" />
            Delete All Player Feedback
          </h3>

          {/* Player Select */}
          <div className="mb-4">
            <label className="block text-xs text-neutral-500 mb-2">Select Player</label>
            <select
              value={selectedPlayer}
              onChange={(e) => {
                setSelectedPlayer(e.target.value);
                setConfirmDelete(false);
                setResult(null);
              }}
              className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">-- Select a player --</option>
              {playersWithRatings.map(({ name, count }) => (
                <option key={name} value={name}>
                  {name} ({count} feedback{count !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Confirmation */}
          {selectedPlayer && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">
                    Delete all {selectedPlayerCount} rating(s) for {selectedPlayer}?
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    This will permanently remove all feedback and history for this player.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-red-500 focus:ring-red-500"
                />
                <span className="text-sm text-neutral-300">I understand this cannot be undone</span>
              </label>
            </div>
          )}

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            disabled={!selectedPlayer || !confirmDelete || isDeleting}
            className={`w-full p-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              !selectedPlayer || !confirmDelete || isDeleting
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete All Feedback
              </>
            )}
          </button>

          {/* Result Message */}
          {result && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              result.success
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {result.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span className="text-sm">{result.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3">
          Database Stats
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-neutral-500">Total Feedback</span>
            <p className="text-xl font-bold text-white">{allRatings.length}</p>
          </div>
          <div>
            <span className="text-neutral-500">Players Rated</span>
            <p className="text-xl font-bold text-white">{playersWithRatings.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
