import React, { useState, useEffect } from 'react';
import { Player, WorkoutLog, AppView } from '../types';
import { db } from '../services/db';
import { PROGRAM } from '../services/programData';
import { ChevronLeft, CheckCircle2, User, ChevronRight, Settings, Users } from 'lucide-react';
import WorkoutSession from './WorkoutSession';
import { 
  getCurrentISOWeek, 
  getISOWeekFromTimestamp, 
  getISOWeekStart, 
  getISOWeekEnd,
  getISOWeek,
  formatWeekIdentifier,
  parseWeekIdentifier,
  WeekIdentifier
} from '../utils/weekUtils';

interface Props {
  onNavigate: (view: AppView) => void;
}

const AthleteView: React.FC<Props> = ({ onNavigate }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [allPlayerLogs, setAllPlayerLogs] = useState<WorkoutLog[]>([]);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentWeek, setCurrentWeek] = useState<WeekIdentifier>(getCurrentISOWeek());
  const [selectedWeek, setSelectedWeek] = useState<WeekIdentifier>(getCurrentISOWeek());

  // Position Update State
  const [isUpdatingPosition, setIsUpdatingPosition] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayers();
    // Auto-link user to their player profile on mount
    autoLinkUserToPlayer();
  }, []);

  const autoLinkUserToPlayer = async () => {
    try {
      const linkedPlayer = await db.getOrCreatePlayerForUser();
      // Set as selected for both Players and Coaches (coaches can log workouts too)
      setSelectedPlayer(linkedPlayer);
      // Update players list if needed
      setPlayers(prev => {
        const exists = prev.find(p => p.id === linkedPlayer.id);
        if (exists) return prev;
        return [...prev, linkedPlayer];
      });
    } catch (e: any) {
      console.error("Failed to auto-link player:", e);
      // If error is about missing profile, redirect to landing
      if (e.message?.includes('not found') || e.message?.includes('complete registration')) {
        onNavigate('LANDING');
      }
    }
  };

  // Filter logs for selected week (use weekYear/week if available, fallback to weekNumber, then timestamp)
  const playerLogs = allPlayerLogs.filter(log => {
    if (log.weekYear && log.week) {
      return log.weekYear === selectedWeek.year && log.week === selectedWeek.week;
    }
    // Fallback for old logs with weekNumber
    if (log.weekNumber) {
      const logWeek = getISOWeekFromTimestamp(log.timestamp);
      return logWeek.year === selectedWeek.year && logWeek.week === selectedWeek.week;
    }
    // Fallback to timestamp-based filtering
    const weekStart = getISOWeekStart(selectedWeek.year, selectedWeek.week).getTime();
    const weekEnd = getISOWeekEnd(selectedWeek.year, selectedWeek.week).getTime();
    return log.timestamp >= weekStart && log.timestamp <= weekEnd;
  });

  useEffect(() => {
    if (selectedPlayer) {
      loadLogs(selectedPlayer.id);
    }
    // Update current week periodically
    const interval = setInterval(() => {
      setCurrentWeek(getCurrentISOWeek());
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedPlayer, activeDayId]); // Reload logs if activeDayId changes (implies return from workout)

  // Reload logs when selectedWeek changes (user navigates to different week)
  useEffect(() => {
    if (selectedPlayer) {
      console.log('[AthleteView] Selected week changed, reloading logs for week:', selectedWeek.year, 'W' + selectedWeek.week);
      loadLogs(selectedPlayer.id);
    }
  }, [selectedWeek.year, selectedWeek.week]);

  const loadPlayers = async () => {
    try {
      const p = await db.getPlayers();
      setPlayers(p);
    } catch (e) {
      console.error("Failed to load players", e);
    }
  };

  const loadLogs = async (id: string) => {
    const logs = await db.getPlayerLogs(id);
    console.log('[AthleteView] Loaded', logs.length, 'logs for player', id);
    if (logs.length > 0) {
      console.log('[AthleteView] Sample logs:', logs.slice(0, 3).map(log => ({
        dayId: log.dayId,
        weekYear: log.weekYear,
        week: log.week,
        weekNumber: log.weekNumber,
        completed: log.completed
      })));
    }
    setAllPlayerLogs(logs);
    // Set current week, but preserve selectedWeek if user has manually selected one
    const current = getCurrentISOWeek();
    setCurrentWeek(current);
    // Only update selectedWeek if it's still the current week (preserve user's selection)
    if (selectedWeek.year === current.year && selectedWeek.week === current.week) {
      setSelectedWeek(current);
    }
  };

  const isDayComplete = (dayId: string) => {
    // Check if day is complete in the selected week
    return playerLogs.some(l => l.dayId === dayId && l.completed);
  };

  const handleUpdatePosition = async (position: 'Forward' | 'Back') => {
    if (!selectedPlayer) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await db.updatePlayerPosition(selectedPlayer.id, position);
      // Update local state
      const updatedPlayer = { ...selectedPlayer, position };
      setSelectedPlayer(updatedPlayer);
      setPlayers(prev => prev.map(p => p.id === selectedPlayer.id ? updatedPlayer : p));
      setIsUpdatingPosition(false);
    } catch (err: any) {
      console.error("Update position failed:", err);
      setError(err.message || "Failed to update position");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If no player selected yet, show loading while we auto-link
  if (!selectedPlayer) {
    return (
      <div className="flex items-center justify-center min-h-[85vh]">
        <div className="text-neutral-400">Loading your profile...</div>
      </div>
    );
  }

  // VIEW: SELECT PLAYER (for switching between players - only shown if user manually cleared selection)
  // Note: This view is rarely shown since we auto-link on mount
  if (players.length > 0 && !selectedPlayer) {
    return (
      <div className="flex flex-col h-[85vh] animate-fade-in">
        <header className="flex items-center mb-6">
          <button onClick={() => onNavigate('LANDING')} className="mr-4 text-neutral-400">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-white">Who are you?</h2>
        </header>

        <input
          type="text"
          placeholder="Search your name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-white mb-4 focus:ring-2 focus:ring-amber-500 outline-none"
        />

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 pb-20 custom-scrollbar">
          {filteredPlayers.length === 0 && players.length > 0 && searchTerm && (
             <div className="text-center text-neutral-500 py-8">No players found matching "{searchTerm}"</div>
          )}
          
          {filteredPlayers.map(player => (
            <button
              key={player.id}
              onClick={() => setSelectedPlayer(player)}
              className="w-full text-left p-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center transition-colors group"
            >
              <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center mr-3 text-neutral-400 group-hover:text-amber-500 group-hover:bg-neutral-700 transition-colors">
                <User size={20} />
              </div>
              <div>
                <div className="font-semibold text-white">{player.name}</div>
                <div className="text-xs text-neutral-400">{player.position || 'No position set'}</div>
              </div>
              <ChevronRight className="ml-auto text-neutral-500 group-hover:text-amber-500 transition-colors" size={20} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // VIEW 3: WORKOUT SESSION
  if (activeDayId) {
    const day = PROGRAM.DAYS.find(d => d.id === activeDayId);
    if (!day) return null;
    // Find log for this day in the selected week
    const weekLog = playerLogs.find(l => l.dayId === activeDayId);
    return (
      <WorkoutSession
        player={selectedPlayer}
        day={day}
        existingLog={weekLog}
        selectedWeek={selectedWeek}
        onExit={() => setActiveDayId(null)}
      />
    );
  }

  // VIEW 4: ATHLETE DASHBOARD (Select Day)
  return (
    <div className="pb-20 animate-fade-in">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome, {selectedPlayer.name.split(' ')[0]}</h1>
          <p className="text-neutral-400 text-sm">
            {selectedPlayer.role === 'Player' 
              ? (selectedPlayer.position ? `${selectedPlayer.position}` : 'Position not set')
              : 'Coach'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('COACH')} 
            className="text-xs text-neutral-400 font-medium hover:text-amber-500 flex items-center gap-1 transition-colors"
          >
            <Users size={14} />
            Stat Board
          </button>
          {selectedPlayer.role === 'Player' && (
            <button 
              onClick={() => setIsUpdatingPosition(true)} 
              className="text-xs text-amber-500 font-medium hover:text-amber-400 flex items-center gap-1"
            >
              <Settings size={14} />
              {selectedPlayer.position ? 'Update Position' : 'Set Position'}
            </button>
          )}
        </div>
      </header>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Go to previous week
              const prevWeekStart = getISOWeekStart(selectedWeek.year, selectedWeek.week);
              prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);
              setSelectedWeek(getISOWeek(prevWeekStart));
            }}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg border border-neutral-800 transition-colors"
          >
            <ChevronLeft size={18} className="text-neutral-400" />
          </button>
          
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={formatWeekIdentifier(selectedWeek)}
              onChange={(e) => {
                const parsed = parseWeekIdentifier(e.target.value);
                if (parsed) {
                  setSelectedWeek(parsed);
                }
              }}
              className="w-24 px-3 py-2 bg-black border border-neutral-800 rounded-lg text-white text-center font-bold text-sm focus:outline-none focus:border-amber-500"
              placeholder="2024-W48"
            />
            {selectedWeek.year === currentWeek.year && selectedWeek.week === currentWeek.week && (
              <span className="text-xs text-amber-500 font-medium">(Current)</span>
            )}
          </div>
          
          <button
            onClick={() => {
              // Go to next week
              const nextWeekStart = getISOWeekStart(selectedWeek.year, selectedWeek.week);
              nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);
              setSelectedWeek(getISOWeek(nextWeekStart));
            }}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg border border-neutral-800 transition-colors"
          >
            <ChevronRight size={18} className="text-neutral-400" />
          </button>
          
          {(selectedWeek.year !== currentWeek.year || selectedWeek.week !== currentWeek.week) && (
            <button
              onClick={() => setSelectedWeek(currentWeek)}
              className="ml-2 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg transition-colors"
            >
              Current Week
            </button>
          )}
        </div>
      </div>

      {/* Position Update Modal */}
      {isUpdatingPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsUpdatingPosition(false)}>
          <div className="bg-neutral-900 rounded-2xl p-6 max-w-sm w-full border border-neutral-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">Update Position</h3>
            
            {error && (
              <div className="bg-red-900/20 border border-red-900/50 p-3 rounded-lg text-red-500 text-sm mb-4">
                {error}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => handleUpdatePosition('Forward')}
                disabled={isSubmitting}
                className={`p-4 rounded-xl border font-bold transition-all ${
                  selectedPlayer.position === 'Forward' 
                    ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
                    : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-amber-500/50'
                } disabled:opacity-50`}
              >
                Forward
              </button>
              <button
                onClick={() => handleUpdatePosition('Back')}
                disabled={isSubmitting}
                className={`p-4 rounded-xl border font-bold transition-all ${
                  selectedPlayer.position === 'Back' 
                    ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
                    : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-amber-500/50'
                } disabled:opacity-50`}
              >
                Back
              </button>
            </div>
            
            <button
              onClick={() => setIsUpdatingPosition(false)}
              className="w-full bg-neutral-800 text-neutral-300 p-3 rounded-xl hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {PROGRAM.DAYS.map((day, index) => {
          const complete = isDayComplete(day.id);
          return (
            <button
              key={day.id}
              onClick={() => setActiveDayId(day.id)}
              className={`
                relative p-6 rounded-2xl border text-left transition-all
                ${complete 
                  ? 'bg-neutral-900 border-neutral-800' 
                  : 'bg-neutral-800 border-neutral-700 hover:border-amber-500/50'
                }
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${complete ? 'text-green-500' : 'text-amber-500'}`}>
                  {day.title}
                </span>
                {complete && <CheckCircle2 className="text-green-500" size={20} />}
              </div>
              
              <h3 className={`text-2xl font-bold mb-1 ${complete ? 'text-neutral-500' : 'text-white'}`}>
                {day.focus}
              </h3>
              
              <div className="text-sm text-neutral-400">
                {day.exercises.length} Exercises
              </div>
              
              {/* Decorative Number */}
              <div className="absolute bottom-2 right-4 text-6xl font-black text-neutral-900 pointer-events-none opacity-50">
                {index + 1}
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="mt-8 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
        <h4 className="text-white font-semibold mb-2 text-sm">Program Notes</h4>
        <ul className="text-xs text-neutral-400 space-y-1 list-disc list-inside">
          <li>Warm up is mandatory every session.</li>
          <li>Weeks 1-2: Establish baseline.</li>
          <li>Weeks 3-5: Add weight (Overload).</li>
          <li>Weeks 6-7: Maximize speed.</li>
        </ul>
      </div>
    </div>
  );
};

export default AthleteView;