import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Search, Users, Filter, X, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, AlertTriangle, Plus, Edit3, Star, GraduationCap, Award } from 'lucide-react';
import { AppView, Player, RosterPlayer, InjuryRecord, PlayerRating, RugbyPosition, RosterClass, Squad as SquadName } from '../types';
import { ROSTER_PLAYERS, getPhotoUrl, GROUP_COLORS, GROUP_DESCRIPTIONS } from '../services/rosterData';
import { STATUS_COLORS, formatInjuryDate, loadInjuries, migrateHardcodedInjuries } from '../services/injuryData';
import { getMyRatingForPlayer, loadRatings, RATING_SKILLS, RATING_COLORS, calculateAverageRating } from '../services/ratingData';
import { loadPositionOverrides, savePlayerPositions, formatPosition, POSITION_OPTIONS, PlayerPositions } from '../services/positionData';
import { db } from '../services/db';
import InjuryModal from './InjuryModal';
import InjuryHistorySection from './InjuryHistorySection';
import RatingModal from './RatingModal';
import RatingHistorySection from './RatingHistorySection';
import GraduateSeniorsModal from './GraduateSeniorsModal';
import SetClassesModal from './SetClassesModal';
import { rosterAlumniNames, gradYearOf, classLabel, classKey, currentClassYears, squadOf, squadLabel, squadFromClass, SQUADS, invalidateRosterContext } from '../services/classYears';
import { useAlumniNames } from '../hooks/useAlumniNames';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

type TrainingGroup = 'All' | 'Black' | 'Gold' | 'Silver' | 'Bronze';
type SquadFilter = 'All' | 'Varsity' | 'JV';
type InjuryStatus = 'All' | 'Injured' | 'Healthy';

// Normalize name for matching (lowercase, remove extra spaces)
const normalizeName = (name: string): string => {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
};

const PlayerList: React.FC<Props> = ({ onNavigate, currentPlayer }) => {
  const isCoach = currentPlayer?.role === 'Coach';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<TrainingGroup>('All');
  const [selectedSquad, setSelectedSquad] = useState<SquadFilter>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [appPlayers, setAppPlayers] = useState<Player[]>([]);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number | null>(null);
  const [selectedInjuryStatus, setSelectedInjuryStatus] = useState<InjuryStatus>('All');
  const [injuries, setInjuries] = useState<InjuryRecord[]>([]);
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [injuryModalPlayer, setInjuryModalPlayer] = useState<RosterPlayer | null>(null);
  const [injuryModalExisting, setInjuryModalExisting] = useState<InjuryRecord | undefined>(undefined);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingModalPlayer, setRatingModalPlayer] = useState<RosterPlayer | null>(null);
  const [currentPlayerRating, setCurrentPlayerRating] = useState<PlayerRating | null>(null);
  const [isLoadingRating, setIsLoadingRating] = useState(false);
  const [myRatingsMap, setMyRatingsMap] = useState<Map<string, boolean>>(new Map());
  const [ratingsRefreshKey, setRatingsRefreshKey] = useState(0);
  const [positionOverrides, setPositionOverrides] = useState<Record<string, PlayerPositions>>({});
  const [editingPositions, setEditingPositions] = useState(false);
  const [editBest, setEditBest] = useState<string>('');
  const [editSecond, setEditSecond] = useState<string>('');
  const [editThird, setEditThird] = useState<string>('');
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const [showGraduate, setShowGraduate] = useState(false);
  const [showSetClasses, setShowSetClasses] = useState(false);
  const [savingClass, setSavingClass] = useState(false);
  // Graduation and alumni years by roster name (shared across coaches)
  const [rosterClasses, setRosterClasses] = useState<Record<string, RosterClass>>({});
  const loadRosterClasses = useCallback(async () => {
    try {
      setRosterClasses(await db.getRosterClasses());
      invalidateRosterContext(); // other screens pick up class, squad and alumni changes
    } catch (error) {
      console.error('[PlayerList] Error loading class years:', error);
    }
  }, []);
  useEffect(() => {
    loadRosterClasses();
  }, [loadRosterClasses]);

  // Team vs Alumni: graduated players only show on the Alumni tab.
  const [showAlumni, setShowAlumni] = useState(false);
  // Shared list (ready = loaded) plus this screen's own data, which updates right after a graduation.
  const { alumniNames: sharedAlumni, ready: alumniReady } = useAlumniNames();
  const alumniNames = useMemo(() => {
    const names = rosterAlumniNames(appPlayers, rosterClasses);
    sharedAlumni.forEach(n => names.add(n));
    return names;
  }, [appPlayers, rosterClasses, sharedAlumni]);
  const teamRoster = useMemo(() => ROSTER_PLAYERS.filter(p => !alumniNames.has(normalizeName(p.name))), [alumniNames]);
  const alumniRoster = useMemo(() => ROSTER_PLAYERS.filter(p => alumniNames.has(normalizeName(p.name))), [alumniNames]);
  // Nothing shows until the alumni list has loaded, so graduates never flash up on Team.
  const shownRoster = !alumniReady ? [] : showAlumni ? alumniRoster : teamRoster;

  // Load app players to cross-reference with roster
  const loadAppPlayers = useCallback(async () => {
    try {
      const players = await db.getPlayers();
      setAppPlayers(players);
      console.log('[PlayerList] Loaded app players:', players.length);
    } catch (error) {
      console.error('[PlayerList] Error loading app players:', error);
    }
  }, []);
  useEffect(() => {
    loadAppPlayers();
  }, [loadAppPlayers]);

  // Load position overrides
  useEffect(() => {
    setPositionOverrides(loadPositionOverrides());
  }, []);

  // Get effective positions for a player (override > hardcoded)
  const getPositions = (player: RosterPlayer): PlayerPositions => {
    const override = positionOverrides[player.name];
    return {
      bestPosition: override?.bestPosition ?? player.bestPosition,
      secondPosition: override?.secondPosition ?? player.secondPosition,
      thirdPosition: override?.thirdPosition ?? player.thirdPosition,
    };
  };

  // Load injuries and migrate hardcoded data if needed
  useEffect(() => {
    const loadInjuriesData = async () => {
      try {
        await migrateHardcodedInjuries();
        const injuryData = await loadInjuries();
        setInjuries(injuryData);
        console.log('[PlayerList] Loaded injuries:', injuryData.length);
      } catch (error) {
        console.error('[PlayerList] Error loading injuries:', error);
      }
    };
    loadInjuriesData();
  }, []);

  // Load current user's ratings to show on player cards
  useEffect(() => {
    const loadMyRatings = async () => {
      if (!currentPlayer?.id) return;
      try {
        const allRatings = await loadRatings();
        const myMap = new Map<string, boolean>();
        allRatings.forEach(r => {
          if (r.raterId === currentPlayer.id) {
            myMap.set(r.playerName.toLowerCase().trim(), true);
          }
        });
        setMyRatingsMap(myMap);
        console.log('[PlayerList] Loaded my ratings map:', myMap.size, 'rated');
      } catch (error) {
        console.error('[PlayerList] Error loading ratings map:', error);
      }
    };
    loadMyRatings();
  }, [currentPlayer?.id, ratingsRefreshKey]);

  // Check if current user has rated a player
  const hasRated = (playerName: string): boolean => {
    return myRatingsMap.has(playerName.toLowerCase().trim());
  };

  // Create injury map for O(1) lookup by player name
  const injuryMap = useMemo(() => {
    const map = new Map<string, InjuryRecord>();
    injuries.forEach(injury => {
      // Only map active injuries (not returned to play)
      if (injury.currentStatus !== 'Returned to Play') {
        const normalized = injury.playerName.toLowerCase().trim();
        map.set(normalized, injury);
      }
    });
    return map;
  }, [injuries]);

  // Get active injury for a player from the map
  const getActiveInjury = (playerName: string): InjuryRecord | undefined => {
    return injuryMap.get(playerName.toLowerCase().trim());
  };

  // Count of injured players
  const injuredCount = useMemo(() => {
    return teamRoster.filter(p => getActiveInjury(p.name)).length;
  }, [injuryMap, teamRoster]);

  // Refresh injuries after modal save
  const handleInjurySaved = async () => {
    try {
      const injuryData = await loadInjuries();
      setInjuries(injuryData);
      console.log('[PlayerList] Refreshed injuries after save');
    } catch (error) {
      console.error('[PlayerList] Error refreshing injuries:', error);
    }
  };

  // Open injury modal for a player
  const openInjuryModal = (player: RosterPlayer, existing?: InjuryRecord) => {
    if (!existing && alumniNames.has(normalizeName(player.name))) return; // alumni aren't scored
    setInjuryModalPlayer(player);
    setInjuryModalExisting(existing);
    setShowInjuryModal(true);
  };

  // Open rating modal for a player
  const openRatingModal = (player: RosterPlayer) => {
    if (alumniNames.has(normalizeName(player.name))) return; // alumni aren't scored
    setRatingModalPlayer(player);
    setShowRatingModal(true);
  };

  // Refresh rating after save
  const handleRatingSaved = async () => {
    // Refresh the fullscreen rating display if open
    if (selectedPlayer && currentPlayer?.id) {
      try {
        const rating = await getMyRatingForPlayer(currentPlayer.id, selectedPlayer.name);
        setCurrentPlayerRating(rating);
        console.log('[PlayerList] Refreshed rating after save');
      } catch (error) {
        console.error('[PlayerList] Error refreshing rating:', error);
      }
    }
    // Refresh the card-level ratings map
    setRatingsRefreshKey(prev => prev + 1);
  };

  // Create a map of normalized names to app players for quick lookup
  const appPlayerMap = useMemo(() => {
    const map = new Map<string, Player>();
    appPlayers.forEach(player => {
      map.set(normalizeName(player.name), player);
    });
    return map;
  }, [appPlayers]);

  // Check if a roster player has a linked app account
  const getLinkedAppPlayer = (rosterPlayer: RosterPlayer): Player | undefined => {
    return appPlayerMap.get(normalizeName(rosterPlayer.name));
  };

  // Filter and search players
  const filteredPlayers = useMemo(() => {
    return shownRoster.filter(player => {
      // Search filter (by name, training group, or squad)
      const matchesSearch = searchQuery === '' ||
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.trainingGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
        squadOf(player, rosterClasses).squad.toLowerCase().includes(searchQuery.toLowerCase());

      // Group filter
      const matchesGroup = selectedGroup === 'All' || player.trainingGroup === selectedGroup;

      // Squad filter
      const matchesSquad = selectedSquad === 'All' || squadOf(player, rosterClasses).squad === selectedSquad;

      // Injury status filter
      const isInjured = !!getActiveInjury(player.name);
      const matchesInjuryStatus = selectedInjuryStatus === 'All' ||
        (selectedInjuryStatus === 'Injured' && isInjured) ||
        (selectedInjuryStatus === 'Healthy' && !isInjured);

      return matchesSearch && matchesGroup && matchesSquad && matchesInjuryStatus;
    });
  }, [searchQuery, selectedGroup, selectedSquad, selectedInjuryStatus, injuryMap, shownRoster]);

  // Group players by training group for display
  const groupedPlayers = useMemo(() => {
    const groups: Record<string, RosterPlayer[]> = {
      Black: [],
      Gold: [],
      Silver: [],
      Bronze: [],
    };

    filteredPlayers.forEach(player => {
      groups[player.trainingGroup].push(player);
    });

    return groups;
  }, [filteredPlayers]);

  // Get current selected player from index
  const selectedPlayer = selectedPlayerIndex !== null ? filteredPlayers[selectedPlayerIndex] : null;

  // Navigation functions for fullscreen mode
  const goToPrevPlayer = useCallback(() => {
    if (selectedPlayerIndex !== null && selectedPlayerIndex > 0) {
      setSelectedPlayerIndex(selectedPlayerIndex - 1);
    }
  }, [selectedPlayerIndex]);

  const goToNextPlayer = useCallback(() => {
    if (selectedPlayerIndex !== null && selectedPlayerIndex < filteredPlayers.length - 1) {
      setSelectedPlayerIndex(selectedPlayerIndex + 1);
    }
  }, [selectedPlayerIndex, filteredPlayers.length]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;

    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        // Swiped left - go to next
        goToNextPlayer();
      } else {
        // Swiped right - go to previous
        goToPrevPlayer();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPlayerIndex === null) return;

      if (e.key === 'ArrowLeft') {
        goToPrevPlayer();
      } else if (e.key === 'ArrowRight') {
        goToNextPlayer();
      } else if (e.key === 'Escape') {
        setSelectedPlayerIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPlayerIndex, goToPrevPlayer, goToNextPlayer]);

  // Load current user's rating when a player is selected in fullscreen
  useEffect(() => {
    setEditingPositions(false);
    const loadRating = async () => {
      if (selectedPlayer && currentPlayer?.id) {
        setIsLoadingRating(true);
        try {
          const rating = await getMyRatingForPlayer(currentPlayer.id, selectedPlayer.name);
          setCurrentPlayerRating(rating);
        } catch (error) {
          console.error('[PlayerList] Error loading rating:', error);
          setCurrentPlayerRating(null);
        } finally {
          setIsLoadingRating(false);
        }
      } else {
        setCurrentPlayerRating(null);
      }
    };
    loadRating();
  }, [selectedPlayer?.name, currentPlayer?.id]);

  // Open fullscreen for a player
  const openFullscreen = (player: RosterPlayer) => {
    const index = filteredPlayers.findIndex(p => p.name === player.name);
    if (index !== -1) {
      setSelectedPlayerIndex(index);
    }
  };

  const handleImageError = (playerName: string) => {
    setImageErrors(prev => new Set(prev).add(playerName));
  };

  const renderPlayerCard = (player: RosterPlayer) => {
    const photoUrl = getPhotoUrl(player.name);
    const hasImageError = imageErrors.has(player.name);
    const groupColor = GROUP_COLORS[player.trainingGroup];
    const linkedPlayer = getLinkedAppPlayer(player);
    const isLinked = !!linkedPlayer;
    const injury = getActiveInjury(player.name);
    const isInjured = !!injury;

    return (
      <div
        key={player.name}
        className={`bg-neutral-900 rounded-lg border overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] ${
          isLinked ? 'border-green-500/50' : 'border-neutral-800'
        }`}
        onClick={() => openFullscreen(player)}
      >
        {/* Photo */}
        <div className="aspect-[4/5] bg-neutral-800 relative">
          {!hasImageError && photoUrl ? (
            <img
              src={photoUrl}
              alt={player.name}
              className={`w-full h-full object-cover ${isInjured ? 'grayscale opacity-70' : ''}`}
              onError={() => handleImageError(player.name)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-600">
              <Users size={48} />
            </div>
          )}
          {/* Injury overlay */}
          {isInjured && (
            <div className="absolute inset-0 bg-red-900/20 flex items-center justify-center">
              <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                <AlertTriangle size={10} />
                INJURED
              </div>
            </div>
          )}
          {/* Training group badge */}
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-bold ${groupColor.bg} ${groupColor.text}`}>
            {player.trainingGroup}
          </div>
          {/* Linked badge */}
          {isLinked && !isInjured && (
            <div className="absolute bottom-2 left-2 p-1 bg-green-500 rounded-full">
              <CheckCircle size={12} className="text-white" />
            </div>
          )}
          {/* Injury status badge */}
          {isInjured && injury && (
            <div className="absolute top-2 right-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[injury.currentStatus]?.bg} ${STATUS_COLORS[injury.currentStatus]?.text} ${STATUS_COLORS[injury.currentStatus]?.border}`}>
                {injury.currentStatus === 'Day to Day' ? 'DTD' : injury.currentStatus === 'IR / Out' ? 'OUT' : 'Q'}
              </span>
            </div>
          )}
          {/* Quick rate star button (not on alumni) */}
          {currentPlayer && !showAlumni && (
            <button
              className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center bg-black/60 rounded-full transition-colors hover:bg-black/80"
              onClick={(e) => {
                e.stopPropagation();
                openRatingModal(player);
              }}
              title={hasRated(player.name) ? 'Update feedback' : 'Give feedback'}
            >
              <Star
                size={16}
                className={hasRated(player.name) ? 'text-amber-400 fill-amber-400' : 'text-neutral-400'}
              />
            </button>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <div className="flex items-center gap-1">
            <h3 className="font-bold text-sm text-white truncate flex-1">{player.name}</h3>
          </div>
          {/* Injury info */}
          {isInjured && injury && (
            <p className="text-xs text-red-400 mt-0.5">{(injury.bodyPart || []).join(', ')} - {(injury.diagnosis || []).join(', ')}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-neutral-400">
            {player.height && <span>{player.height}</span>}
            {player.height && player.weight && <span>•</span>}
            {player.weight && <span>{player.weight} lbs</span>}
          </div>
          {/* Position badges */}
          {(() => {
            const pos = getPositions(player);
            return pos.bestPosition ? (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {formatPosition(pos.bestPosition)}
                </span>
                {pos.secondPosition && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                    {pos.secondPosition}
                  </span>
                )}
                {pos.thirdPosition && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                    {pos.thirdPosition}
                  </span>
                )}
              </div>
            ) : null;
          })()}
          {isLinked && (
            <p className="text-[10px] text-green-400 mt-1">Email linked</p>
          )}
        </div>
      </div>
    );
  };

  const renderGroupSection = (group: string, players: RosterPlayer[]) => {
    if (players.length === 0) return null;

    const groupColor = GROUP_COLORS[group];
    const description = GROUP_DESCRIPTIONS[group];

    return (
      <div key={group} className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-4 h-4 rounded ${groupColor.bg} ${groupColor.border} border`}></div>
          <h2 className="text-lg font-bold text-white">{group} Group</h2>
          <span className="text-xs text-neutral-500">({description})</span>
          <span className="text-xs text-neutral-600 ml-auto">{players.length} players</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {players.map(renderPlayerCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-neutral-950 z-10 pb-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => onNavigate('LANDING')}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Player Roster</h1>
            <p className="text-xs text-neutral-500">
              {teamRoster.length} players • {appPlayers.length > 0 && (
                <span className="text-green-400">{teamRoster.filter(p => getLinkedAppPlayer(p)).length} linked</span>
              )} • 2026 Season
            </p>
          </div>
        </div>

        {/* Team | Alumni */}
        <div className="grid grid-cols-2 gap-2 p-1 mb-3 bg-neutral-900 border border-neutral-800 rounded-xl">
          {[false, true].map(alumni => (
            <button
              key={String(alumni)}
              onClick={() => { setShowAlumni(alumni); setSelectedPlayerIndex(null); }}
              className={`py-2 rounded-lg text-sm font-bold transition-all ${
                showAlumni === alumni ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {alumni ? `Alumni (${alumniRoster.length})` : `Team (${teamRoster.length})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${showFilters ? 'bg-amber-500 text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}
        >
          <Filter size={16} />
          Filters
          {(selectedGroup !== 'All' || selectedSquad !== 'All' || selectedInjuryStatus !== 'All') && (
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>
        {isCoach && (
          <button
            onClick={() => setShowSetClasses(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-neutral-900 text-amber-400 hover:text-white transition-colors"
          >
            <Award size={16} />
            Set Classes
          </button>
        )}
        {isCoach && (
          <button
            onClick={() => setShowGraduate(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-neutral-900 text-purple-300 hover:text-white transition-colors"
          >
            <GraduationCap size={16} />
            Graduate Seniors
          </button>
        )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
            {/* Training Group Filter */}
            <div className="mb-4">
              <label className="text-xs text-neutral-500 mb-2 block">Training Group</label>
              <div className="flex flex-wrap gap-2">
                {(['All', 'Black', 'Gold', 'Silver', 'Bronze'] as TrainingGroup[]).map(group => (
                  <button
                    key={group}
                    onClick={() => setSelectedGroup(group)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedGroup === group
                        ? group === 'All'
                          ? 'bg-amber-500 text-black'
                          : `${GROUP_COLORS[group]?.bg || 'bg-amber-500'} ${GROUP_COLORS[group]?.text || 'text-black'}`
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            {/* Squad Filter */}
            <div className="mb-4">
              <label className="text-xs text-neutral-500 mb-2 block">Squad</label>
              <div className="flex flex-wrap gap-2">
                {(['All', 'Varsity', 'JV'] as SquadFilter[]).map(squad => (
                  <button
                    key={squad}
                    onClick={() => setSelectedSquad(squad)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedSquad === squad
                        ? 'bg-amber-500 text-black'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {squad}
                  </button>
                ))}
              </div>
            </div>

            {/* Injury Status Filter */}
            <div>
              <label className="text-xs text-neutral-500 mb-2 block">Injury Status</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedInjuryStatus('All')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedInjuryStatus === 'All'
                      ? 'bg-amber-500 text-black'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedInjuryStatus('Injured')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    selectedInjuryStatus === 'Injured'
                      ? 'bg-red-500 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <AlertTriangle size={14} />
                  Injured
                  {injuredCount > 0 && (
                    <span className="bg-neutral-900/50 px-1.5 py-0.5 rounded text-xs">{injuredCount}</span>
                  )}
                </button>
                <button
                  onClick={() => setSelectedInjuryStatus('Healthy')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    selectedInjuryStatus === 'Healthy'
                      ? 'bg-green-500 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <CheckCircle size={14} />
                  Healthy
                </button>
              </div>
            </div>

            {/* Clear filters */}
            {(selectedGroup !== 'All' || selectedSquad !== 'All' || selectedInjuryStatus !== 'All') && (
              <button
                onClick={() => {
                  setSelectedGroup('All');
                  setSelectedSquad('All');
                  setSelectedInjuryStatus('All');
                }}
                className="mt-4 text-xs text-amber-500 hover:text-amber-400"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {filteredPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
          <AlertCircle size={48} className="mb-4" />
          <p>No players found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : selectedGroup === 'All' ? (
        // Show grouped by training group
        <>
          {renderGroupSection('Black', groupedPlayers.Black)}
          {renderGroupSection('Gold', groupedPlayers.Gold)}
          {renderGroupSection('Silver', groupedPlayers.Silver)}
          {renderGroupSection('Bronze', groupedPlayers.Bronze)}
        </>
      ) : (
        // Show flat list when filtered to specific group
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredPlayers.map(renderPlayerCard)}
        </div>
      )}

      {/* Fullscreen Photo Modal */}
      {selectedPlayer && selectedPlayerIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setSelectedPlayerIndex(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button - top left */}
          <button
            className="absolute top-4 left-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPlayerIndex(null);
            }}
          >
            <X size={32} />
          </button>

          {/* Navigation counter */}
          <div className="absolute top-4 right-4 text-neutral-500 text-sm">
            {selectedPlayerIndex + 1} / {filteredPlayers.length}
          </div>

          {/* Previous button */}
          {selectedPlayerIndex > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-white hover:bg-white/10 rounded-full transition-colors hidden sm:block"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevPlayer();
              }}
            >
              <ChevronLeft size={40} />
            </button>
          )}

          {/* Next button */}
          {selectedPlayerIndex < filteredPlayers.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white hover:bg-white/10 rounded-full transition-colors hidden sm:block"
              onClick={(e) => {
                e.stopPropagation();
                goToNextPlayer();
              }}
            >
              <ChevronRight size={40} />
            </button>
          )}

          <div className="max-w-lg w-full px-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const selectedInjury = getActiveInjury(selectedPlayer.name);
              const isSelectedInjured = !!selectedInjury;
              return (
                <>
                  {/* Photo */}
                  <div className="relative">
                    {!imageErrors.has(selectedPlayer.name) && getPhotoUrl(selectedPlayer.name) ? (
                      <img
                        src={getPhotoUrl(selectedPlayer.name)}
                        alt={selectedPlayer.name}
                        className={`w-full rounded-lg ${isSelectedInjured ? 'grayscale opacity-70' : ''}`}
                        onError={() => handleImageError(selectedPlayer.name)}
                      />
                    ) : (
                      <div className="w-full aspect-[4/5] bg-neutral-800 rounded-lg flex items-center justify-center">
                        <Users size={96} className="text-neutral-600" />
                      </div>
                    )}

                    {/* Injury overlay */}
                    {isSelectedInjured && (
                      <div className="absolute inset-0 bg-red-900/30 rounded-lg flex items-center justify-center">
                        <div className="bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2">
                          <AlertTriangle size={18} />
                          INJURED
                        </div>
                      </div>
                    )}

                    {/* Training group badge */}
                    <div className={`absolute top-4 left-4 px-3 py-1 rounded text-sm font-bold ${GROUP_COLORS[selectedPlayer.trainingGroup].bg} ${GROUP_COLORS[selectedPlayer.trainingGroup].text}`}>
                      {selectedPlayer.trainingGroup} Group
                    </div>

                    {/* Linked indicator */}
                    {getLinkedAppPlayer(selectedPlayer) && !isSelectedInjured && (
                      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-green-500 rounded text-sm font-bold text-white">
                        <CheckCircle size={16} />
                        Linked
                      </div>
                    )}

                    {/* Injury status badge */}
                    {isSelectedInjured && selectedInjury && (
                      <div className="absolute top-4 right-4">
                        <span className={`text-sm px-3 py-1 rounded border ${STATUS_COLORS[selectedInjury.currentStatus]?.bg} ${STATUS_COLORS[selectedInjury.currentStatus]?.text} ${STATUS_COLORS[selectedInjury.currentStatus]?.border}`}>
                          {selectedInjury.currentStatus}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="mt-4 text-center">
                    <h2 className="text-2xl font-bold text-white">{selectedPlayer.name}</h2>

                    <div className="flex items-center justify-center gap-4 mt-3 text-neutral-300">
                      {selectedPlayer.height && (
                        <div>
                          <span className="text-neutral-500 text-sm">Height</span>
                          <p className="font-bold">{selectedPlayer.height}</p>
                        </div>
                      )}
                      {selectedPlayer.weight && (
                        <div>
                          <span className="text-neutral-500 text-sm">Weight</span>
                          <p className="font-bold">{selectedPlayer.weight} lbs</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-sm text-neutral-500">
                      {squadLabel(squadOf(selectedPlayer, rosterClasses))}
                    </div>

                    {/* Class: everyone sees it, coaches can change it */}
                    {(() => {
                      const gradYear = gradYearOf(selectedPlayer, rosterClasses);
                      const alumniClass = rosterClasses[classKey(selectedPlayer.name)]?.alumniClass;
                      const years = currentClassYears();
                      // Keep an out-of-range saved year selectable (e.g. a fifth-year player).
                      const options = gradYear && !years.includes(gradYear) ? [...years, gradYear].sort() : years;
                      return (
                        <div className="mt-4 p-4 bg-neutral-900 border border-neutral-800 rounded-lg text-left flex items-center justify-between gap-3">
                          <div>
                            <p className="text-neutral-300 font-bold text-sm">Class</p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              {alumniClass ? `Alumni · Class of ${alumniClass}` : gradYear ? classLabel(gradYear) : 'Not set'}
                            </p>
                          </div>
                          {isCoach && !showAlumni && (
                            <select
                              value={gradYear ?? ''}
                              disabled={savingClass}
                              onChange={async e => {
                                const value = e.target.value === '' ? null : parseInt(e.target.value);
                                setSavingClass(true);
                                try {
                                  await db.setRosterClass(classKey(selectedPlayer.name), selectedPlayer.name, { gradYear: value });
                                  await loadRosterClasses();
                                } catch (err) {
                                  console.error('[PlayerList] Could not save class:', err);
                                } finally {
                                  setSavingClass(false);
                                }
                              }}
                              className="px-2 py-1.5 rounded-md bg-black border border-neutral-700 text-xs text-white disabled:opacity-50"
                            >
                              <option value="">Not set</option>
                              {options.map(y => <option key={y} value={y}>{classLabel(y)}</option>)}
                            </select>
                          )}
                        </div>
                      );
                    })()}

                    {/* Squad: from the class (freshmen and sophomores are JV); coaches can override */}
                    {isCoach && !showAlumni && (() => {
                      const info = squadOf(selectedPlayer, rosterClasses);
                      const override = rosterClasses[classKey(selectedPlayer.name)]?.squad ?? '';
                      const gradYear = gradYearOf(selectedPlayer, rosterClasses);
                      const auto = gradYear ? squadFromClass(gradYear) : 'Varsity';
                      return (
                        <div className="mt-4 p-4 bg-neutral-900 border border-neutral-800 rounded-lg text-left flex items-center justify-between gap-3">
                          <div>
                            <p className="text-neutral-300 font-bold text-sm">Squad</p>
                            <p className="text-xs text-neutral-400 mt-0.5">{squadLabel(info)}</p>
                          </div>
                          <select
                            value={override}
                            disabled={savingClass}
                            onChange={async e => {
                              const value = e.target.value === '' ? null : (e.target.value as SquadName);
                              setSavingClass(true);
                              try {
                                await db.setRosterClass(classKey(selectedPlayer.name), selectedPlayer.name, { squad: value });
                                await loadRosterClasses();
                              } catch (err) {
                                console.error('[PlayerList] Could not save squad:', err);
                              } finally {
                                setSavingClass(false);
                              }
                            }}
                            className="px-2 py-1.5 rounded-md bg-black border border-neutral-700 text-xs text-white disabled:opacity-50"
                          >
                            <option value="">{gradYear ? `By class (${auto})` : 'By class (not set)'}</option>
                            {SQUADS.map(sq => <option key={sq} value={sq}>{sq}</option>)}
                          </select>
                        </div>
                      );
                    })()}

                    {/* Positions Section */}
                    {(() => {
                      const pos = getPositions(selectedPlayer);
                      const hasPositions = pos.bestPosition || pos.secondPosition || pos.thirdPosition;

                      return (
                        <div className="mt-4 p-4 bg-neutral-900 border border-neutral-800 rounded-lg text-left">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-neutral-300 font-bold text-sm">Positions</p>
                            {isCoach && !editingPositions && !showAlumni && (
                              <button
                                onClick={() => {
                                  setEditingPositions(true);
                                  setEditBest(pos.bestPosition?.toString() || '');
                                  setEditSecond(pos.secondPosition?.toString() || '');
                                  setEditThird(pos.thirdPosition?.toString() || '');
                                }}
                                className="flex items-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-xs text-neutral-300 transition-colors"
                              >
                                <Edit3 size={12} />
                                Edit
                              </button>
                            )}
                          </div>

                          {editingPositions ? (
                            <div className="space-y-3">
                              {[
                                { label: 'Best Position', value: editBest, setter: setEditBest },
                                { label: '2nd Position', value: editSecond, setter: setEditSecond },
                                { label: '3rd Position', value: editThird, setter: setEditThird },
                              ].map(({ label, value, setter }) => (
                                <div key={label}>
                                  <label className="text-xs text-neutral-500 mb-1 block">{label}</label>
                                  <select
                                    value={value}
                                    onChange={(e) => setter(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="">Not set</option>
                                    {POSITION_OPTIONS.map(opt => (
                                      <option key={`${label}-${opt.value}`} value={opt.value}>
                                        {opt.short} — {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={() => {
                                    const newPositions: PlayerPositions = {
                                      bestPosition: editBest ? Number(editBest) as RugbyPosition : undefined,
                                      secondPosition: editSecond ? Number(editSecond) as RugbyPosition : undefined,
                                      thirdPosition: editThird ? Number(editThird) as RugbyPosition : undefined,
                                    };
                                    savePlayerPositions(selectedPlayer.name, newPositions);
                                    setPositionOverrides(loadPositionOverrides());
                                    setEditingPositions(false);
                                  }}
                                  className="flex-1 px-3 py-2 bg-amber-500 text-black font-bold rounded-lg text-sm hover:bg-amber-400 transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingPositions(false)}
                                  className="px-3 py-2 bg-neutral-800 text-neutral-300 rounded-lg text-sm hover:bg-neutral-700 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : hasPositions ? (
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <span className="text-[10px] text-neutral-500 block mb-1">Best</span>
                                <span className="text-sm font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 inline-block">
                                  {formatPosition(pos.bestPosition)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-neutral-500 block mb-1">2nd</span>
                                <span className="text-sm font-bold px-2 py-1 rounded bg-neutral-800 text-neutral-300 inline-block">
                                  {formatPosition(pos.secondPosition)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-neutral-500 block mb-1">3rd</span>
                                <span className="text-sm font-bold px-2 py-1 rounded bg-neutral-800 text-neutral-300 inline-block">
                                  {formatPosition(pos.thirdPosition)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-600">No positions assigned</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Player Rating Section (any logged-in user) */}
                    {currentPlayer && (
                      <div className="mt-4">
                        {/* Current Rating Display */}
                        {currentPlayerRating && (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-left mb-3">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Star size={18} className="text-amber-400" />
                                <p className="text-amber-400 font-bold">Your Feedback</p>
                              </div>
                              <span className="text-xs text-neutral-500">
                                {new Date(currentPlayerRating.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                              {RATING_SKILLS.map(skill => {
                                const value = currentPlayerRating.ratings[skill.key] ?? 0;
                                if (value === 0) return null; // Skip unrated optional skills
                                return (
                                  <div key={skill.key} className="flex flex-col items-center">
                                    <span className="text-[10px] text-neutral-500 mb-1">{skill.shortLabel}</span>
                                    <span className={`text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center ${RATING_COLORS[value].bg} ${RATING_COLORS[value].text}`}>
                                      {value}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between">
                              <span className="text-xs text-neutral-400">Average: {calculateAverageRating(currentPlayerRating.ratings).toFixed(1)}</span>
                              {!showAlumni && (
                              <button
                                onClick={() => openRatingModal(selectedPlayer)}
                                className="flex items-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-xs text-neutral-300 transition-colors"
                              >
                                <Edit3 size={12} />
                                Update
                              </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Rate Player Button (when no rating exists) */}
                        {!currentPlayerRating && !isLoadingRating && !showAlumni && (
                          <button
                            onClick={() => openRatingModal(selectedPlayer)}
                            className="flex items-center justify-center gap-2 w-full p-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 font-medium rounded-lg transition-colors"
                          >
                            <Star size={18} />
                            Give Feedback
                          </button>
                        )}

                        {/* Rating History Section */}
                        <RatingHistorySection playerName={selectedPlayer.name} currentPlayer={currentPlayer} />
                      </div>
                    )}

                    {/* Injury details */}
                    {isSelectedInjured && selectedInjury && (
                      <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-400" />
                            <p className="text-red-400 font-bold">Injury Report</p>
                          </div>
                          {isCoach && (
                            <button
                              onClick={() => openInjuryModal(selectedPlayer, selectedInjury)}
                              className="flex items-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-xs text-neutral-300 transition-colors"
                            >
                              <Edit3 size={12} />
                              Edit
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-neutral-500">Body Part</span>
                            <p className="text-white">{(selectedInjury.bodyPart || []).join(', ') || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-neutral-500">Diagnosis</span>
                            <p className="text-white">{(selectedInjury.diagnosis || []).join(', ') || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-neutral-500">Type</span>
                            <p className="text-white">{(selectedInjury.injuryType || []).join(', ') || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-neutral-500">Date</span>
                            <p className="text-white">{formatInjuryDate(selectedInjury.dateOfInjury)}</p>
                          </div>
                        </div>
                        {selectedInjury.notes && (
                          <p className="mt-2 text-xs text-neutral-400">{selectedInjury.notes}</p>
                        )}
                      </div>
                    )}

                    {/* Coach: Add injury button (when not currently injured) */}
                    {isCoach && !isSelectedInjured && !showAlumni && (
                      <button
                        onClick={() => openInjuryModal(selectedPlayer)}
                        className="mt-4 flex items-center justify-center gap-2 w-full p-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-medium rounded-lg transition-colors"
                      >
                        <Plus size={18} />
                        Report Injury
                      </button>
                    )}

                    {/* Injury History Section (coaches only) */}
                    {isCoach && (
                      <InjuryHistorySection playerName={selectedPlayer.name} />
                    )}

                    {/* Linked account info */}
                    {!isSelectedInjured && getLinkedAppPlayer(selectedPlayer) && (
                      <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-green-400 text-sm font-medium">Email Linked</p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Swipe hint on mobile */}
          <p className="text-center text-neutral-600 text-xs mt-6 sm:hidden">Swipe left/right to navigate</p>
        </div>
      )}

      {/* Injury Modal */}
      {injuryModalPlayer && currentPlayer && (
        <InjuryModal
          isOpen={showInjuryModal}
          onClose={() => {
            setShowInjuryModal(false);
            setInjuryModalPlayer(null);
            setInjuryModalExisting(undefined);
          }}
          onSave={handleInjurySaved}
          player={injuryModalPlayer}
          existingInjury={injuryModalExisting}
          currentPlayer={currentPlayer}
        />
      )}

      {/* Rating Modal */}
      {ratingModalPlayer && currentPlayer && (
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => {
            setShowRatingModal(false);
            setRatingModalPlayer(null);
          }}
          onSave={handleRatingSaved}
          player={ratingModalPlayer}
          currentPlayer={currentPlayer}
        />
      )}
      {showGraduate && (
        <GraduateSeniorsModal
          appPlayers={appPlayers}
          rosterClasses={rosterClasses}
          onClose={() => setShowGraduate(false)}
          onDone={() => { loadAppPlayers(); loadRosterClasses(); }}
        />
      )}
      {showSetClasses && (
        <SetClassesModal
          appPlayers={appPlayers}
          rosterClasses={rosterClasses}
          onClose={() => setShowSetClasses(false)}
          onDone={loadRosterClasses}
        />
      )}
    </div>
  );
};

export default PlayerList;
