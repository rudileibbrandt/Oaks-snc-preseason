import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Search, X, AlertCircle } from 'lucide-react';
import { AppView, Player, PlayerRating } from '../types';
import { loadRatings } from '../services/ratingData';
import { ROSTER_PLAYERS } from '../services/rosterData';
import { getPlayersWithRatings } from '../services/ratingAnalytics';
import ThreeSixtyView from './ThreeSixtyView';
import MyRatingsComparison from './MyRatingsComparison';
import TeamInsights from './TeamInsights';
import AdminPanel from './AdminPanel';
import RaterView from './RaterView';
import FeedbackReview from './FeedbackReview';
import { useAlumniNames } from '../hooks/useAlumniNames';
import { currentRatingsOnly } from '../services/classYears';
import { normalizeName } from '../services/alumni';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

type TabType = '360' | 'my-ratings' | 'by-rater' | 'team-insights' | 'review' | 'admin';

const RatingAnalytics: React.FC<Props> = ({ onNavigate, currentPlayer }) => {
  const [activeTab, setActiveTab] = useState<TabType>('360');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allRatings, setAllRatings] = useState<PlayerRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isCoach = currentPlayer?.role?.toLowerCase() === 'coach';

  // Graduated players are hidden here (the viewer always sees their own ratings).
  // The Admin tab still gets every rating.
  const { alumniNames, ready: alumniReady } = useAlumniNames();
  const currentRatings = useMemo(
    () => currentRatingsOnly(allRatings, alumniNames, currentPlayer?.name),
    [allRatings, alumniNames, currentPlayer?.name],
  );
  console.log('[RatingAnalytics] currentPlayer role:', currentPlayer?.role, 'isCoach:', currentPlayer?.role?.toLowerCase() === 'coach');

  // Load all ratings on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const ratings = await loadRatings();
        setAllRatings(ratings);
        console.log('[RatingAnalytics] Loaded ratings:', ratings.length);
      } catch (error) {
        console.error('[RatingAnalytics] Error loading ratings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Get list of players with ratings
  const playersWithRatings = useMemo(() => {
    return getPlayersWithRatings(currentRatings);
  }, [currentRatings]);

  // Auto-select own name for non-coaches, lock to self
  useEffect(() => {
    if (!isCoach && currentPlayer?.name) {
      setSelectedPlayer(currentPlayer.name);
    }
  }, [isCoach, currentPlayer?.name]);

  // Guard: if a player somehow has a selectedPlayer that isn't themselves, reset it
  useEffect(() => {
    if (!isCoach && currentPlayer?.name && selectedPlayer && selectedPlayer !== currentPlayer.name) {
      setSelectedPlayer(currentPlayer.name);
    }
  }, [isCoach, currentPlayer?.name, selectedPlayer]);

  // Filter roster players that match search and have ratings (or are in roster)
  const filteredPlayers = useMemo(() => {
    // Non-coaches can only see themselves
    if (!isCoach && currentPlayer?.name) {
      return [currentPlayer.name];
    }

    if (!alumniReady) return []; // wait for the alumni list so graduates never flash up
    const rosterNames = ROSTER_PLAYERS.map(p => p.name).filter(n => !alumniNames.has(normalizeName(n)));
    const allPlayerNames = Array.from(new Set([...rosterNames, ...playersWithRatings])).sort();

    if (!searchQuery.trim()) {
      return allPlayerNames;
    }

    return allPlayerNames.filter(name =>
      name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, playersWithRatings, isCoach, currentPlayer?.name, alumniNames, alumniReady]);

  // Handle player selection
  const handleSelectPlayer = (playerName: string) => {
    setSelectedPlayer(playerName);
    setSearchQuery('');
  };

  // Clear player selection
  const handleClearPlayer = () => {
    setSelectedPlayer('');
    setSearchQuery('');
  };

  // Count ratings for info display
  const ratingCount = useMemo(() => {
    if (!selectedPlayer) return 0;
    return allRatings.filter(
      r => r.playerName.toLowerCase().trim() === selectedPlayer.toLowerCase().trim()
    ).length;
  }, [selectedPlayer, allRatings]);

  // Refresh ratings after admin actions
  const refreshRatings = async () => {
    setIsLoading(true);
    try {
      const ratings = await loadRatings();
      setAllRatings(ratings);
      setSelectedPlayer('');
      console.log('[RatingAnalytics] Refreshed ratings:', ratings.length);
    } catch (error) {
      console.error('[RatingAnalytics] Error refreshing ratings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTabs = () => (
    <div className="flex border-b border-neutral-800 mb-4">
      <button
        onClick={() => setActiveTab('360')}
        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
          activeTab === '360'
            ? 'text-amber-500'
            : 'text-neutral-400 hover:text-neutral-300'
        }`}
      >
        360 View
        {activeTab === '360' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
        )}
      </button>
      <button
        onClick={() => setActiveTab('my-ratings')}
        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
          activeTab === 'my-ratings'
            ? 'text-amber-500'
            : 'text-neutral-400 hover:text-neutral-300'
        }`}
      >
        My Feedback
        {activeTab === 'my-ratings' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
        )}
      </button>
      {isCoach && (
        <button
          onClick={() => setActiveTab('by-rater')}
          className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'by-rater'
              ? 'text-amber-500'
              : 'text-neutral-400 hover:text-neutral-300'
          }`}
        >
          By Rater
          {activeTab === 'by-rater' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
          )}
        </button>
      )}
      {isCoach && (
        <button
          onClick={() => setActiveTab('team-insights')}
          className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'team-insights'
              ? 'text-amber-500'
              : 'text-neutral-400 hover:text-neutral-300'
          }`}
        >
          Team Insights
          {activeTab === 'team-insights' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
          )}
        </button>
      )}
      {isCoach && (
        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'review'
              ? 'text-amber-500'
              : 'text-neutral-400 hover:text-neutral-300'
          }`}
        >
          Review
          {activeTab === 'review' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
          )}
        </button>
      )}
      {isCoach && (
        <button
          onClick={() => setActiveTab('admin')}
          className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'admin'
              ? 'text-red-500'
              : 'text-neutral-400 hover:text-neutral-300'
          }`}
        >
          Admin
          {activeTab === 'admin' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
          )}
        </button>
      )}
    </div>
  );

  const renderPlayerSelector = () => {
    // Non-coaches see a read-only banner with their own name
    if (!isCoach) {
      return (
        <div className="mb-6">
          <div className="flex items-center gap-2 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
            <span className="flex-1 text-amber-400 font-medium">{currentPlayer?.name || 'Unknown Player'}</span>
            <span className="text-xs text-neutral-400">{ratingCount} feedback{ratingCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      );
    }

    // Coaches get the full player selector
    return (
      <div className="mb-6">
        {/* Selected Player Banner */}
        {selectedPlayer && (
          <div className="flex items-center gap-2 p-3 mb-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
            <span className="flex-1 text-amber-400 font-medium">{selectedPlayer}</span>
            <span className="text-xs text-neutral-400">{ratingCount} feedback{ratingCount !== 1 ? 's' : ''}</span>
            <button
              onClick={handleClearPlayer}
              className="p-1 hover:bg-neutral-800 rounded transition-colors"
            >
              <X size={16} className="text-neutral-400" />
            </button>
          </div>
        )}

        {/* Search Filter */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Filter players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-800 rounded"
            >
              <X size={14} className="text-neutral-500" />
            </button>
          )}
        </div>

        {/* Player List - Always Visible */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map(player => {
              const hasRatings = playersWithRatings.includes(player);
              const playerRatingCount = allRatings.filter(
                r => r.playerName.toLowerCase().trim() === player.toLowerCase().trim()
              ).length;
              const isSelected = selectedPlayer === player;

              return (
                <button
                  key={player}
                  onClick={() => handleSelectPlayer(player)}
                  className={`w-full px-4 py-2.5 text-left transition-colors flex items-center justify-between border-b border-neutral-800 last:border-b-0 ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'hover:bg-neutral-800'
                  }`}
                >
                  <span className={isSelected ? 'text-amber-400 font-medium' : hasRatings ? 'text-white' : 'text-neutral-400'}>
                    {player}
                  </span>
                  {hasRatings && (
                    <span className={`text-xs ${isSelected ? 'text-amber-400/70' : 'text-neutral-500'}`}>
                      {playerRatingCount} feedback{playerRatingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-sm text-neutral-500 text-center">
              No players found
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-600 mt-2">{filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}</p>
      </div>
    );
  };


  const renderContent = () => {
    if (isLoading || !alumniReady) {
      return (
        <div className="flex items-center justify-center py-16 text-neutral-500">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-neutral-700 border-t-amber-500 rounded-full mx-auto mb-4" />
            <p>Loading feedback...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case '360':
        return (
          <ThreeSixtyView
            allRatings={currentRatings}
            selectedPlayer={selectedPlayer}
            currentPlayer={currentPlayer}
          />
        );
      case 'my-ratings':
        return (
          <MyRatingsComparison
            allRatings={currentRatings}
            selectedPlayer={selectedPlayer}
            currentPlayer={currentPlayer}
          />
        );
      case 'by-rater':
        return isCoach ? (
          <RaterView allRatings={currentRatings} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <AlertCircle size={48} className="mb-4" />
            <p>Coach access required</p>
          </div>
        );
      case 'team-insights':
        return isCoach ? (
          <TeamInsights allRatings={currentRatings} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <AlertCircle size={48} className="mb-4" />
            <p>Coach access required</p>
          </div>
        );
      case 'review':
        return isCoach ? (
          <FeedbackReview allRatings={currentRatings} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <AlertCircle size={48} className="mb-4" />
            <p>Coach access required</p>
          </div>
        );
      case 'admin':
        return isCoach ? (
          <AdminPanel allRatings={allRatings} onRatingsDeleted={refreshRatings} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <AlertCircle size={48} className="mb-4" />
            <p>Coach access required</p>
          </div>
        );
      default:
        return null;
    }
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
            <h1 className="text-xl font-bold text-white">Player Progression</h1>
            <p className="text-xs text-neutral-500">
              {currentRatings.length} total feedbacks across {playersWithRatings.length} players
            </p>
          </div>
        </div>

        {renderTabs()}
      </div>

      {/* Player Selector (for 360 and My Ratings tabs) */}
      {(activeTab === '360' || activeTab === 'my-ratings') && renderPlayerSelector()}

      {/* Tab Content */}
      {renderContent()}
    </div>
  );
};

export default RatingAnalytics;
