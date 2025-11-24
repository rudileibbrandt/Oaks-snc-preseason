import React, { useState, useEffect, useMemo } from 'react';
import { Player, WorkoutLog, AppView } from '../types';
import { db } from '../services/db';
import { UserPlus, LogOut, Trophy, ChevronRight, AlertCircle, X, Dumbbell, ChevronLeft, TrendingUp, Users } from 'lucide-react';
import { PROGRAM } from '../services/programData';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
  currentPlayer?: Player | null;
  refreshTrigger?: number; // Optional prop to trigger refresh
}

const CoachDashboard: React.FC<Props> = ({ onNavigate, currentPlayer, refreshTrigger }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekIdentifier>(getCurrentISOWeek());
  const [selectedWeek, setSelectedWeek] = useState<WeekIdentifier>(getCurrentISOWeek());
  
  // View States
  const [viewMode, setViewMode] = useState<'completion' | 'metrics' | 'analytics' | 'performers'>('completion');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayerForChart, setSelectedPlayerForChart] = useState<Player | null>(null);

  // Auto-select current player for analytics if they're a player
  useEffect(() => {
    if (viewMode === 'analytics' && currentPlayer?.role === 'Player') {
      setSelectedPlayerForChart(currentPlayer);
    } else if (viewMode === 'analytics' && currentPlayer?.role === 'Coach' && !selectedPlayerForChart) {
      // For coaches, don't auto-select - let them choose
      setSelectedPlayerForChart(null);
    }
  }, [viewMode, currentPlayer]);
  
  // Async states
  const [error, setError] = useState<string | null>(null);

  // Filter logs for selected week (use weekYear/week if available, fallback to weekNumber, then timestamp)
  const logs = allLogs.filter(log => {
    // Check if log has weekYear and week fields (explicitly check for undefined, not just truthy)
    if (log.weekYear !== undefined && log.week !== undefined) {
      const matches = log.weekYear === selectedWeek.year && log.week === selectedWeek.week;
      if (matches) {
        console.log('[CoachDashboard] Matched log:', { 
          playerId: log.playerId, 
          dayId: log.dayId, 
          weekYear: log.weekYear, 
          week: log.week,
          selectedWeek: selectedWeek 
        });
      }
      return matches;
    }
    // Fallback for old logs with weekNumber
    if (log.weekNumber !== undefined) {
      // Try to match old weekNumber to ISO week (approximate)
      const logWeek = getISOWeekFromTimestamp(log.timestamp);
      return logWeek.year === selectedWeek.year && logWeek.week === selectedWeek.week;
    }
    // Fallback to timestamp-based filtering
    const weekStart = getISOWeekStart(selectedWeek.year, selectedWeek.week).getTime();
    const weekEnd = getISOWeekEnd(selectedWeek.year, selectedWeek.week).getTime();
    return log.timestamp >= weekStart && log.timestamp <= weekEnd;
  });
  
  console.log('[CoachDashboard] Filtered logs for week', formatWeekIdentifier(selectedWeek), ':', logs.length, 'logs out of', allLogs.length, 'total');

  useEffect(() => {
    loadData();
    // Update current week periodically (in case week changes while viewing)
    const interval = setInterval(() => {
      setCurrentWeek(getCurrentISOWeek());
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Reload data when refreshTrigger changes (e.g., when navigating to stat board)
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadData();
    }
  }, [refreshTrigger]);

  const loadData = async () => {
    try {
      const p = await db.getPlayers();
      const l = await db.getLogs();
      setPlayers(p);
      setAllLogs(l);
      // Set current week and default selected week to current
      const current = getCurrentISOWeek();
      setCurrentWeek(current);
      setSelectedWeek(current);
    } catch (e: any) {
      console.error("Load failed", e);
      if (e.code === 'permission-denied') {
        setError("Database Permission Denied. Run: firebase deploy --only firestore:rules");
      }
    }
  };



  // Helper to check status (for selected week only)
  // Returns: 'complete' if all exercises are done, 'partial' if some are done, 'empty' if none
  const getStatus = (playerId: string, dayId: string) => {
    // Use logs filtered by selected week
    const log = logs.find(l => l.playerId === playerId && l.dayId === dayId);
    if (!log || !log.data) return 'empty';
    
    // Find the day definition
    const day = PROGRAM.DAYS.find(d => d.id === dayId);
    if (!day) return 'empty';
    
    // Count exercises that need data (isMetric: true)
    const exercisesNeedingData = day.exercises.filter(ex => ex.isMetric);
    if (exercisesNeedingData.length === 0) return 'empty';
    
    // Check how many exercises have data
    let exercisesWithData = 0;
    for (const exercise of exercisesNeedingData) {
      if (exercise.isSprint) {
        // For sprints, need sets and time
        const hasSets = log.data[`${exercise.id}_sets`] && log.data[`${exercise.id}_sets`].trim() !== '';
        const hasTime = log.data[`${exercise.id}_time`] && log.data[`${exercise.id}_time`].trim() !== '';
        if (hasSets && hasTime) {
          exercisesWithData++;
        }
      } else {
        // For lifts, need weight
        const hasWeight = log.data[`${exercise.id}_weight`] && log.data[`${exercise.id}_weight`].trim() !== '';
        if (hasWeight) {
          exercisesWithData++;
        }
      }
    }
    
    if (exercisesWithData === 0) return 'empty';
    if (exercisesWithData === exercisesNeedingData.length) return 'complete';
    return 'partial';
  };

  // Helper to get exercise value (weight for lifts, time for sprints)
  // For "Best" view, show the best value across ALL weeks, not just selected week
  const getExerciseValue = (playerId: string, exerciseId: string, isSprint?: boolean) => {
    // Use ALL logs (not filtered by week) to find best across all weeks
    const playerLogs = allLogs.filter(l => l.playerId === playerId && l.data);
    
    if (playerLogs.length === 0) return '-';

    // Find the best value (max weight or min time) across all weeks
    let bestValue: number | null = null;
    let unit = '';

    for (const log of playerLogs) {
      if (isSprint) {
        const time = parseFloat(log.data[`${exerciseId}_time`]);
        if (!isNaN(time)) {
          if (bestValue === null || time < bestValue) { // Lower time is better for sprints
            bestValue = time;
            unit = 's';
          }
        }
      } else {
        const weight = parseFloat(log.data[`${exerciseId}_weight`]);
        if (!isNaN(weight)) {
          if (bestValue === null || weight > bestValue) { // Higher weight is better for lifts
            bestValue = weight;
            unit = 'lbs';
          }
        }
      }
    }
    
    return bestValue !== null ? `${bestValue}${unit}` : '-';
  };

  // Get all exercises from all days (excluding warmup)
  const ALL_EXERCISES = PROGRAM.DAYS.flatMap(day => 
    day.exercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      dayId: day.id,
      dayTitle: day.title,
      isSprint: ex.isSprint || false
    }))
  );

  // Helper to get rankings for an exercise (for Best view)
  const getExerciseRankings = (exerciseId: string, isSprint?: boolean) => {
    const rankings: Array<{ playerId: string; playerName: string; value: number; displayValue: string }> = [];
    
    // Filter: Players only see other players, Coaches see everyone
    const visiblePlayers = currentPlayer?.role === 'Player' 
      ? players.filter(p => p.role === 'Player')  // Players only see other players
      : players;  // Coaches see everyone (players and coaches)
    
    for (const player of visiblePlayers) {
      const playerLogs = allLogs.filter(l => l.playerId === player.id && l.data);
      let bestValue: number | null = null;
      
      for (const log of playerLogs) {
        if (isSprint) {
          const time = parseFloat(log.data[`${exerciseId}_time`]);
          if (!isNaN(time)) {
            if (bestValue === null || time < bestValue) {
              bestValue = time;
            }
          }
        } else {
          const weight = parseFloat(log.data[`${exerciseId}_weight`]);
          if (!isNaN(weight)) {
            if (bestValue === null || weight > bestValue) {
              bestValue = weight;
            }
          }
        }
      }
      
      if (bestValue !== null) {
        rankings.push({
          playerId: player.id,
          playerName: player.name,
          value: bestValue,
          displayValue: isSprint ? `${bestValue}s` : `${bestValue}lbs`
        });
      }
    }
    
    // Sort: for sprints (lower is better), for lifts (higher is better)
    rankings.sort((a, b) => {
      if (isSprint) {
        return a.value - b.value; // Lower time is better
      } else {
        return b.value - a.value; // Higher weight is better
      }
    });
    
    return rankings;
  };

  // Calculate player scores for sorting (volume + sprint performance)
  const getPlayerScore = (playerId: string) => {
    const playerLogs = allLogs.filter(l => l.playerId === playerId && l.data);
    let totalVolume = 0;
    let sprintScore = 0;
    let sprintCount = 0;

    for (const log of playerLogs) {
      if (!log.data) continue;

      // Calculate volume for weighted exercises
      for (const day of PROGRAM.DAYS) {
        for (const exercise of day.exercises) {
          if (!exercise.isMetric || exercise.isSprint) continue;

          const weight = parseFloat(log.data[`${exercise.id}_weight`] || '0');
          const sets = parseFloat(log.data[`${exercise.id}_sets`] || '0');
          const reps = parseFloat(log.data[`${exercise.id}_reps`] || '0');

          if (weight > 0 && sets > 0 && reps > 0) {
            totalVolume += weight * sets * reps;
          }
        }
      }

      // Calculate sprint score (lower time = higher score)
      const sprintTime = parseFloat(log.data['d4_1_time'] || '0');
      if (sprintTime > 0) {
        // Convert time to score: faster times get higher scores
        // Use inverse relationship: score = 100 / time (scaled)
        sprintScore += 100 / sprintTime;
        sprintCount++;
      }
    }

    // Average sprint score if we have sprints
    const avgSprintScore = sprintCount > 0 ? sprintScore / sprintCount : 0;
    
    // Combine: volume (in thousands) + sprint score (scaled)
    // Scale volume down to similar magnitude as sprint score
    return totalVolume / 1000 + avgSprintScore * 10;
  };

  // Calculate completion rate for a player
  const getPlayerCompletionRate = (playerId: string) => {
    const current = getCurrentISOWeek();
    const weeks: WeekIdentifier[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = getISOWeekStart(current.year, current.week);
      weekStart.setUTCDate(weekStart.getUTCDate() - (i * 7));
      weeks.push(getISOWeek(weekStart));
    }

    let totalPossible = 0;
    let completed = 0;

    for (const week of weeks) {
      const weekLogs = allLogs.filter(log => {
        if (log.playerId !== playerId) return false;
        if (log.weekYear !== undefined && log.week !== undefined) {
          return log.weekYear === week.year && log.week === week.week;
        }
        if (log.weekNumber !== undefined) {
          const logWeek = getISOWeekFromTimestamp(log.timestamp);
          return logWeek.year === week.year && logWeek.week === week.week;
        }
        const weekStart = getISOWeekStart(week.year, week.week).getTime();
        const weekEnd = getISOWeekEnd(week.year, week.week).getTime();
        return log.timestamp >= weekStart && log.timestamp <= weekEnd;
      });

      totalPossible += 4; // 4 days per week
      for (const day of PROGRAM.DAYS) {
        const dayLog = weekLogs.find(l => l.dayId === day.id);
        if (dayLog && dayLog.completed) {
          completed++;
        }
      }
    }

    return totalPossible > 0 ? Math.round((completed / totalPossible) * 100) : 0;
  };

  // Calculate player score for a specific week
  const getPlayerScoreForWeek = (playerId: string, week: WeekIdentifier) => {
    const weekLogs = allLogs.filter(log => {
      if (log.playerId !== playerId || !log.data) return false;
      if (log.weekYear !== undefined && log.week !== undefined) {
        return log.weekYear === week.year && log.week === week.week;
      }
      if (log.weekNumber !== undefined) {
        const logWeek = getISOWeekFromTimestamp(log.timestamp);
        return logWeek.year === week.year && logWeek.week === week.week;
      }
      const weekStart = getISOWeekStart(week.year, week.week).getTime();
      const weekEnd = getISOWeekEnd(week.year, week.week).getTime();
      return log.timestamp >= weekStart && log.timestamp <= weekEnd;
    });

    let totalVolume = 0;
    let sprintScore = 0;
    let sprintCount = 0;

    for (const log of weekLogs) {
      if (!log.data) continue;

      // Calculate volume for weighted exercises
      for (const day of PROGRAM.DAYS) {
        for (const exercise of day.exercises) {
          if (!exercise.isMetric || exercise.isSprint) continue;

          const weight = parseFloat(log.data[`${exercise.id}_weight`] || '0');
          const sets = parseFloat(log.data[`${exercise.id}_sets`] || '0');
          const reps = parseFloat(log.data[`${exercise.id}_reps`] || '0');

          if (weight > 0 && sets > 0 && reps > 0) {
            totalVolume += weight * sets * reps;
          }
        }
      }

      // Calculate sprint score (lower time = higher score)
      const sprintTime = parseFloat(log.data['d4_1_time'] || '0');
      if (sprintTime > 0) {
        sprintScore += 100 / sprintTime;
        sprintCount++;
      }
    }

    const avgSprintScore = sprintCount > 0 ? sprintScore / sprintCount : 0;
    return totalVolume / 1000 + avgSprintScore * 10;
  };

  // Calculate consistent top and bottom performers across all weeks
  const consistentPerformers = useMemo(() => {
    if (viewMode !== 'performers') return { top: [], bottom: [] };

    // Get all unique weeks from logs
    const weekSet = new Set<string>();
    allLogs.forEach(log => {
      if (log.weekYear !== undefined && log.week !== undefined) {
        weekSet.add(`${log.weekYear}-W${log.week}`);
      } else if (log.weekNumber !== undefined || log.timestamp) {
        const logWeek = getISOWeekFromTimestamp(log.timestamp);
        weekSet.add(`${logWeek.year}-W${logWeek.week}`);
      }
    });

    const weeks: WeekIdentifier[] = Array.from(weekSet).map(weekStr => {
      const [year, weekPart] = weekStr.split('-W');
      return { year: parseInt(year), week: parseInt(weekPart) };
    }).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.week - b.week;
    });

    if (weeks.length === 0) return { top: [], bottom: [] };

    // Filter to only players (not coaches) for this view
    const playerPlayers = players.filter(p => p.role === 'Player');

    // Track rankings for each player
    const playerRankings: Record<string, { top10Count: number; bottom10Count: number; totalWeeks: number; avgRank: number; ranks: number[] }> = {};

    playerPlayers.forEach(player => {
      playerRankings[player.id] = {
        top10Count: 0,
        bottom10Count: 0,
        totalWeeks: 0,
        avgRank: 0,
        ranks: []
      };
    });

    // For each week, rank all players
    weeks.forEach(week => {
      const weekScores = playerPlayers.map(player => ({
        playerId: player.id,
        score: getPlayerScoreForWeek(player.id, week)
      })).filter(p => p.score > 0); // Only include players with data for this week

      if (weekScores.length === 0) return;

      // Sort by score descending
      weekScores.sort((a, b) => b.score - a.score);

      // Update rankings
      weekScores.forEach((entry, index) => {
        const rank = index + 1;
        const stats = playerRankings[entry.playerId];
        if (stats) {
          stats.totalWeeks++;
          stats.ranks.push(rank);
          if (rank <= 10) {
            stats.top10Count++;
          }
          if (rank > weekScores.length - 10) {
            stats.bottom10Count++;
          }
        }
      });
    });

    // Calculate average ranks
    Object.keys(playerRankings).forEach(playerId => {
      const stats = playerRankings[playerId];
      if (stats.ranks.length > 0) {
        stats.avgRank = stats.ranks.reduce((a, b) => a + b, 0) / stats.ranks.length;
      }
    });

    // Find top 10 most consistently in top 10
    const topPerformers = playerPlayers
      .map(player => ({
        ...player,
        ...playerRankings[player.id],
        consistencyScore: playerRankings[player.id].top10Count / Math.max(1, playerRankings[player.id].totalWeeks)
      }))
      .filter(p => p.totalWeeks > 0)
      .sort((a, b) => {
        // Sort by consistency (top10Count/totalWeeks), then by avgRank
        if (b.consistencyScore !== a.consistencyScore) {
          return b.consistencyScore - a.consistencyScore;
        }
        return a.avgRank - b.avgRank;
      })
      .slice(0, 10);

    // Find bottom 10 most consistently in bottom 10
    const bottomPerformers = playerPlayers
      .map(player => ({
        ...player,
        ...playerRankings[player.id],
        consistencyScore: playerRankings[player.id].bottom10Count / Math.max(1, playerRankings[player.id].totalWeeks)
      }))
      .filter(p => p.totalWeeks > 0)
      .sort((a, b) => {
        // Sort by consistency (bottom10Count/totalWeeks), then by avgRank descending
        if (b.consistencyScore !== a.consistencyScore) {
          return b.consistencyScore - a.consistencyScore;
        }
        return b.avgRank - a.avgRank;
      })
      .slice(0, 10);

    return { top: topPerformers, bottom: bottomPerformers };
  }, [allLogs, players, viewMode]);

  // Sort players based on view mode
  // Filter: Players only see other players, Coaches see everyone
  const sortedPlayers = useMemo(() => {
    // Filter players based on current user's role
    const visiblePlayers = currentPlayer?.role === 'Player' 
      ? players.filter(p => p.role === 'Player')  // Players only see other players
      : players;  // Coaches see everyone (players and coaches)
    
    const playersWithScores = visiblePlayers.map(player => ({
      ...player,
      score: getPlayerScore(player.id),
      completionRate: getPlayerCompletionRate(player.id)
    }));

    if (viewMode === 'completion') {
      // Sort by completion rate (descending), then by score as secondary
      return playersWithScores.sort((a, b) => {
        if (b.completionRate !== a.completionRate) {
          return b.completionRate - a.completionRate;
        }
        return b.score - a.score;
      });
    } else {
      // Sort by score (descending), then by completion rate as secondary
      return playersWithScores.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.completionRate - a.completionRate;
      });
    }
  }, [players, allLogs, viewMode, currentPlayer]);

  // Calculate completion rates for analytics
  const completionData = useMemo(() => {
    const current = getCurrentISOWeek();
    const weeks: WeekIdentifier[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = getISOWeekStart(current.year, current.week);
      weekStart.setUTCDate(weekStart.getUTCDate() - (i * 7));
      weeks.push(getISOWeek(weekStart));
    }

    const playerPlayers = players.filter(p => p.role === 'Player');
    
    return weeks.map(week => {
      const weekLogs = allLogs.filter(log => {
        if (log.weekYear !== undefined && log.week !== undefined) {
          return log.weekYear === week.year && log.week === week.week;
        }
        if (log.weekNumber !== undefined) {
          const logWeek = getISOWeekFromTimestamp(log.timestamp);
          return logWeek.year === week.year && logWeek.week === week.week;
        }
        const weekStart = getISOWeekStart(week.year, week.week).getTime();
        const weekEnd = getISOWeekEnd(week.year, week.week).getTime();
        return log.timestamp >= weekStart && log.timestamp <= weekEnd;
      });

      const totalPossible = playerPlayers.length * 4; // 4 days per week
      let completed = 0;
      
      for (const player of playerPlayers) {
        for (const day of PROGRAM.DAYS) {
          const dayLog = weekLogs.find(l => l.playerId === player.id && l.dayId === day.id);
          if (dayLog && dayLog.completed) {
            completed++;
          }
        }
      }

      return {
        week: formatWeekIdentifier(week),
        completionRate: totalPossible > 0 ? Math.round((completed / totalPossible) * 100) : 0,
        completed,
        total: totalPossible
      };
    });
  }, [allLogs, players]);

  // Calculate individual player improvement
  const playerImprovementData = useMemo(() => {
    if (!selectedPlayerForChart) return [];

    const current = getCurrentISOWeek();
    const weeks: WeekIdentifier[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = getISOWeekStart(current.year, current.week);
      weekStart.setUTCDate(weekStart.getUTCDate() - (i * 7));
      weeks.push(getISOWeek(weekStart));
    }

    // Get a key exercise to track (Hex Bar Deadlift)
    const keyExercise = 'd1_1';
    
    return weeks.map(week => {
      const weekLogs = allLogs.filter(log => {
        if (log.playerId !== selectedPlayerForChart.id) return false;
        if (log.weekYear !== undefined && log.week !== undefined) {
          return log.weekYear === week.year && log.week === week.week;
        }
        if (log.weekNumber !== undefined) {
          const logWeek = getISOWeekFromTimestamp(log.timestamp);
          return logWeek.year === week.year && logWeek.week === week.week;
        }
        const weekStart = getISOWeekStart(week.year, week.week).getTime();
        const weekEnd = getISOWeekEnd(week.year, week.week).getTime();
        return log.timestamp >= weekStart && log.timestamp <= weekEnd;
      });

      // Find best weight for key exercise this week
      let bestWeight = 0;
      for (const log of weekLogs) {
        if (log.data && log.data[`${keyExercise}_weight`]) {
          const weight = parseFloat(log.data[`${keyExercise}_weight`]);
          if (!isNaN(weight) && weight > bestWeight) {
            bestWeight = weight;
          }
        }
      }

      // Count completed workouts
      const completedWorkouts = weekLogs.filter(l => l.completed).length;

      return {
        week: formatWeekIdentifier(week),
        weight: bestWeight,
        completedWorkouts
      };
    });
  }, [allLogs, selectedPlayerForChart]);

  return (
    <div className="pb-20 animate-fade-in relative">
      <div className="flex justify-between items-center mb-6">
        <div>
                  <h2 className="text-2xl font-black text-white flex items-center tracking-tight">
                    <Trophy className="mr-2 text-amber-500" fill="currentColor" />
                    STAT BOARD
                  </h2>
                  <p className="text-neutral-500 text-xs uppercase tracking-widest ml-1">Team Performance</p>
        </div>
        <div className="flex items-center gap-2">
          {currentPlayer?.role === 'Player' && (
            <button 
              onClick={() => onNavigate('ATHLETE_SELECT')} 
              className="text-xs text-neutral-400 font-medium hover:text-amber-500 flex items-center gap-1 px-3 py-2 bg-neutral-900 rounded-lg border border-neutral-800 transition-colors"
            >
              <Dumbbell size={14} />
              My Workouts
            </button>
          )}
          <button onClick={() => onNavigate('LANDING')} className="p-2 text-neutral-400 hover:text-white bg-neutral-900 rounded-lg border border-neutral-800">
            <LogOut size={20} />
          </button>
        </div>
      </div>

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

      {/* View Toggle */}
      <div className="flex p-1 bg-neutral-900 rounded-xl mb-6 border border-neutral-800">
        <button
          onClick={() => setViewMode('completion')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
            viewMode === 'completion' ? 'bg-neutral-800 text-white shadow-lg' : 'text-neutral-500 hover:text-white'
          }`}
        >
          Workouts Completed
        </button>
        <button
          onClick={() => setViewMode('metrics')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
            viewMode === 'metrics' ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-500 hover:text-white'
          }`}
        >
          Best
        </button>
        <button
          onClick={() => setViewMode('analytics')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
            viewMode === 'analytics' ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-500 hover:text-white'
          }`}
        >
          Analytics
        </button>
        {currentPlayer?.role === 'Coach' && (
          <button
            onClick={() => setViewMode('performers')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              viewMode === 'performers' ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-500 hover:text-white'
            }`}
          >
            Performers
          </button>
        )}
      </div>

      {error && (
            <div className="mb-6 bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-start text-red-500 text-sm">
              <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-6 mb-8">
          {/* Team Completion Rate Chart - Only show for coaches */}
          {currentPlayer?.role === 'Coach' && (
            <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Users className="mr-2 text-amber-500" size={20} />
                Team Completion Rate (Last 8 Weeks)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={completionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="week" 
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                    label={{ value: 'Completion %', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#171717', 
                      border: '1px solid #404040',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: any) => [`${value}%`, 'Completion Rate']}
                  />
                  <Bar dataKey="completionRate" fill="#f59e0b" radius={[8, 8, 0, 0]}>
                    {completionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.completionRate >= 80 ? '#10b981' : entry.completionRate >= 60 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Individual Player Improvement */}
          <div className="space-y-6">
            {/* Player selector - only show for coaches */}
            {currentPlayer?.role === 'Coach' && (
              <div className="mb-4">
                <select
                  value={selectedPlayerForChart?.id || ''}
                  onChange={(e) => {
                    const player = players.find(p => p.id === e.target.value);
                    setSelectedPlayerForChart(player || null);
                  }}
                  className="bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select a player...</option>
                  {players.filter(p => p.role === 'Player').map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedPlayerForChart && playerImprovementData.length > 0 && (
              <>
                {/* Weight Progression Chart */}
                <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <TrendingUp className="mr-2 text-amber-500" size={20} />
                    {selectedPlayerForChart.name} - Weight Progression
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={playerImprovementData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="week" 
                        stroke="#9ca3af"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="#9ca3af"
                        style={{ fontSize: '12px' }}
                        label={{ value: 'Weight (lbs)', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#171717', 
                          border: '1px solid #404040',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        name="Best Weight (lbs)"
                        dot={{ fill: '#f59e0b', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Completion Chart */}
                <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Users className="mr-2 text-amber-500" size={20} />
                    {selectedPlayerForChart.name} - Workout Completion
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={playerImprovementData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="week" 
                        stroke="#9ca3af"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="#9ca3af"
                        style={{ fontSize: '12px' }}
                        label={{ value: 'Completed Workouts', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#171717', 
                          border: '1px solid #404040',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                      <Bar dataKey="completedWorkouts" fill="#10b981" radius={[8, 8, 0, 0]}>
                        {playerImprovementData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.completedWorkouts === 4 ? '#10b981' : entry.completedWorkouts >= 2 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Performers View - Coach Only */}
      {viewMode === 'performers' && currentPlayer?.role === 'Coach' && (
        <div className="space-y-6">
          {/* Top 10 Performers */}
          <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-xl">
            <div className="p-6 bg-gradient-to-r from-amber-500/20 to-amber-500/10 border-b border-amber-500/30">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Trophy className="mr-3 text-amber-500" size={28} />
                Top 10 Consistent Performers
              </h2>
              <p className="text-sm text-neutral-400 mt-2">Players who consistently rank in the top 10 across all weeks</p>
            </div>
            <div className="p-6">
              {consistentPerformers.top.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  No data available yet
                </div>
              ) : (
                <div className="space-y-3">
                  {consistentPerformers.top.map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl border border-neutral-700 hover:border-amber-500/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <div className="flex items-center flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mr-4 ${
                          index === 0 ? 'bg-amber-500 text-black' :
                          index === 1 ? 'bg-neutral-400 text-black' :
                          index === 2 ? 'bg-amber-800 text-white' :
                          'bg-neutral-700 text-neutral-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center mr-3 text-xs font-bold text-neutral-400 border border-neutral-600">
                              {player.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-white">{player.name}</div>
                              <div className="text-xs text-neutral-500">{player.position || 'No position'}</div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-amber-500">
                            {Math.round(player.consistencyScore * 100)}% Top 10
                          </div>
                          <div className="text-xs text-neutral-500">
                            Avg Rank: {player.avgRank.toFixed(1)}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {player.top10Count}/{player.totalWeeks} weeks
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom 10 Performers */}
          <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-xl">
            <div className="p-6 bg-gradient-to-r from-red-500/20 to-red-500/10 border-b border-red-500/30">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <AlertCircle className="mr-3 text-red-500" size={28} />
                Bottom 10 Consistent Performers
              </h2>
              <p className="text-sm text-neutral-400 mt-2">Players who consistently rank in the bottom 10 across all weeks</p>
            </div>
            <div className="p-6">
              {consistentPerformers.bottom.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  No data available yet
                </div>
              ) : (
                <div className="space-y-3">
                  {consistentPerformers.bottom.map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl border border-neutral-700 hover:border-red-500/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <div className="flex items-center flex-1">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mr-4 bg-neutral-700 text-neutral-300">
                          {consistentPerformers.bottom.length - index}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center mr-3 text-xs font-bold text-neutral-400 border border-neutral-600">
                              {player.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-white">{player.name}</div>
                              <div className="text-xs text-neutral-500">{player.position || 'No position'}</div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-red-500">
                            {Math.round(player.consistencyScore * 100)}% Bottom 10
                          </div>
                          <div className="text-xs text-neutral-500">
                            Avg Rank: {player.avgRank.toFixed(1)}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {player.bottom10Count}/{player.totalWeeks} weeks
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Table Area - Hide in analytics and performers views */}
      {viewMode !== 'analytics' && viewMode !== 'performers' && (
      <div className="bg-neutral-900/50 rounded-xl overflow-hidden border border-neutral-800 mb-8 shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left text-neutral-400 min-w-max">
            <thead className="bg-black text-neutral-200 uppercase text-[10px] tracking-wider font-bold sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-neutral-500 sticky left-0 bg-black z-20">Rank</th>
                <th className="px-2 py-2 text-neutral-500 sticky left-8 bg-black z-20">Player</th>
                {viewMode === 'completion' ? (
                  <>
                    <th className="px-2 py-3 text-center">D1</th>
                    <th className="px-2 py-3 text-center">D2</th>
                    <th className="px-2 py-3 text-center">D3</th>
                    <th className="px-2 py-3 text-center">D4</th>
                  </>
                ) : (
                  ALL_EXERCISES.map(ex => (
                    <th key={ex.id} className="px-2 py-3 text-center text-amber-500" title={ex.name}>
                      <div className="text-[9px] leading-tight">{ex.name}</div>
                      <div className="text-[8px] text-neutral-500 mt-0.5">{ex.dayTitle}</div>
                    </th>
                  ))
                )}
                <th className="px-2 py-3 text-center text-amber-500">Completion</th>
                <th className="px-2 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => (
                <tr key={player.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  <td className="px-2 py-2 text-center font-bold text-neutral-400 sticky left-0 bg-neutral-900/95 z-10">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mx-auto ${
                      index === 0 ? 'bg-amber-500 text-black' :
                      index === 1 ? 'bg-neutral-400 text-black' :
                      index === 2 ? 'bg-amber-800 text-white' :
                      'bg-neutral-800 text-neutral-400'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-2 py-2 font-medium text-white cursor-pointer group sticky left-8 bg-neutral-900/95 z-10" onClick={() => setSelectedPlayer(player)}>
                    <div className="flex items-center">
                      <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center mr-2 text-[10px] font-bold text-neutral-500 border border-neutral-700 flex-shrink-0">
                        {player.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm group-hover:text-amber-500 transition-colors truncate">{player.name}</div>
                        <div className="text-[9px] text-neutral-600 uppercase truncate">{player.position || 'No position'}</div>
                      </div>
                    </div>
                  </td>
                  
                          {viewMode === 'completion' ? (
                            PROGRAM.DAYS.map(day => {
                              const status = getStatus(player.id, day.id);
                              return (
                                <td key={day.id} className="px-2 py-2 text-center">
                                  <div className={`w-3 h-3 rounded-sm rotate-45 mx-auto transition-all ${
                                    status === 'complete' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                                    status === 'partial' ? 'bg-amber-500' :
                                    'bg-transparent border border-neutral-800'
                                  }`} />
                                </td>
                              );
                            })
                          ) : (
                    ALL_EXERCISES.map(ex => (
                      <td key={ex.id} className="px-2 py-2 text-center font-mono text-white font-bold text-xs">
                        {getExerciseValue(player.id, ex.id, ex.isSprint)}
                      </td>
                    ))
                  )}

                  <td className="px-2 py-2 text-center">
                    <div className={`text-xs font-bold ${
                      player.completionRate >= 80 ? 'text-green-500' :
                      player.completionRate >= 60 ? 'text-amber-500' :
                      'text-red-500'
                    }`}>
                      {player.completionRate}%
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                     <button onClick={() => setSelectedPlayer(player)} className="p-1 text-neutral-600 hover:text-amber-500">
                        <ChevronRight size={14} />
                     </button>
                  </td>
                </tr>
              ))}
              {sortedPlayers.length === 0 && (
                <tr>
                  <td colSpan={viewMode === 'completion' ? 7 : ALL_EXERCISES.length + 4} className="p-8 text-center text-neutral-500">No players registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Roster List */}
      <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
        <h3 className="font-bold text-white mb-4 flex items-center text-xs uppercase tracking-wide">
          <UserPlus size={14} className="mr-2 text-amber-500" /> 
          Registered Players ({players.length})
        </h3>
        
        <div className="max-h-32 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {players.length === 0 ? (
              <p className="text-neutral-500 text-xs text-center py-4">No players registered yet. Players will appear here after they sign up.</p>
            ) : (
              players.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2 bg-black/40 rounded border border-neutral-800/50">
                      <span className="text-xs text-neutral-400">{p.name} {p.role === 'Player' && p.position ? `(${p.position})` : p.role === 'Coach' ? '(Coach)' : ''}</span>
                  </div>
              ))
            )}
        </div>
      </div>
      
      {/* Player Details Modal - Different views for Completion vs Best */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)}>
          <div className="bg-neutral-900 w-full max-w-2xl max-h-[80vh] rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-black/40">
              <div>
                <h3 className="text-2xl font-black text-white italic">{selectedPlayer.name}</h3>
                <p className="text-amber-500 text-xs font-bold uppercase tracking-widest">
                  {viewMode === 'completion' 
                    ? (selectedPlayer.position || 'No position set')
                    : 'All-Time Best Rankings'
                  }
                </p>
              </div>
              <button onClick={() => setSelectedPlayer(null)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {viewMode === 'completion' ? (
                // Completion view: Show workout details for selected week
                PROGRAM.DAYS.map(day => {
                  const dayLog = logs.find(l => l.playerId === selectedPlayer.id && l.dayId === day.id);
                  const isComplete = dayLog?.completed;
                  
                  return (
                    <div key={day.id} className={`p-4 rounded-xl border ${isComplete ? 'bg-neutral-900/50 border-green-900/30' : 'bg-neutral-900 border-neutral-800'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-neutral-300 text-sm uppercase">{day.title}: {day.focus}</h4>
                        {isComplete ? (
                           <span className="px-2 py-1 bg-green-900/20 text-green-500 text-[10px] font-bold uppercase rounded tracking-wider">Complete</span>
                        ) : (
                           <span className="px-2 py-1 bg-neutral-800 text-neutral-500 text-[10px] font-bold uppercase rounded tracking-wider">Incomplete</span>
                        )}
                      </div>
                      
                      {/* Show all exercises for this day, with logged values if available */}
                      <div className="space-y-2">
                        {day.exercises.map(exercise => {
                          const weightKey = `${exercise.id}_weight`;
                          const timeKey = `${exercise.id}_time`;
                          const setsKey = `${exercise.id}_sets`;
                          const repsKey = `${exercise.id}_reps`;
                          
                          const weight = dayLog?.data?.[weightKey];
                          const time = dayLog?.data?.[timeKey];
                          const sets = dayLog?.data?.[setsKey];
                          const reps = dayLog?.data?.[repsKey];
                          
                          if (!weight && !time && !sets && !reps) {
                            return null;
                          }
                          
                          return (
                            <div key={exercise.id} className="bg-black/40 p-3 rounded-lg border border-neutral-800/50">
                              <div className="font-semibold text-white text-sm mb-2">{exercise.name}</div>
                              <div className="flex flex-wrap gap-3 text-xs">
                                {exercise.isSprint ? (
                                  <>
                                    {sets && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-neutral-400">Sets:</span>
                                        <span className="font-mono text-amber-500 font-bold">{sets}</span>
                                      </div>
                                    )}
                                    {time && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-neutral-400">Time:</span>
                                        <span className="font-mono text-amber-500 font-bold">{time}s</span>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {weight && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-neutral-400">Weight:</span>
                                        <span className="font-mono text-amber-500 font-bold">{weight}lbs</span>
                                      </div>
                                    )}
                                    {reps && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-neutral-400">Reps:</span>
                                        <span className="font-mono text-amber-500 font-bold">{reps}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {dayLog && dayLog.data && Object.keys(dayLog.data).length === 0 && (
                          <div className="text-xs text-neutral-500 text-center py-2">No exercise data logged</div>
                        )}
                        {!dayLog && (
                          <div className="text-xs text-neutral-500 text-center py-2">No workout logged for this day</div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                // Best view: Show stat board rankings for each exercise
                ALL_EXERCISES.map(exercise => {
                  const rankings = getExerciseRankings(exercise.id, exercise.isSprint);
                  
                  if (rankings.length === 0) {
                    return (
                      <div key={exercise.id} className="p-4 rounded-xl border bg-neutral-900 border-neutral-800">
                        <h4 className="font-bold text-neutral-300 text-sm mb-2">{exercise.name}</h4>
                        <div className="text-xs text-neutral-500 text-center py-2">No data available</div>
                      </div>
                    );
                  }
                  
                  const totalPlayers = rankings.length;
                  const top10 = rankings.slice(0, 10);
                  const remaining = rankings.slice(10);
                  
                  // Calculate percentile groups for remaining players
                  const percentileGroups: Array<{ percentile: string; players: typeof remaining; startRank: number; endRank: number }> = [];
                  if (remaining.length > 0) {
                    // Calculate percentile ranges based on total players
                    const top25End = Math.ceil(totalPlayers * 0.25);
                    const top50End = Math.ceil(totalPlayers * 0.50);
                    const top75End = Math.ceil(totalPlayers * 0.75);
                    
                    // Top 25% (ranks 11 to top25End, but only if top25End > 10)
                    if (top25End > 10) {
                      const group = remaining.slice(0, Math.max(0, top25End - 10));
                      if (group.length > 0) {
                        percentileGroups.push({ 
                          percentile: 'Top 25%', 
                          players: group,
                          startRank: 11,
                          endRank: top25End
                        });
                      }
                    }
                    
                    // Top 50% (ranks after top25End to top50End)
                    if (top50End > top25End) {
                      const group = remaining.slice(Math.max(0, top25End - 10), Math.max(0, top50End - 10));
                      if (group.length > 0) {
                        percentileGroups.push({ 
                          percentile: 'Top 50%', 
                          players: group,
                          startRank: top25End + 1,
                          endRank: top50End
                        });
                      }
                    }
                    
                    // Top 75% (ranks after top50End to top75End)
                    if (top75End > top50End) {
                      const group = remaining.slice(Math.max(0, top50End - 10), Math.max(0, top75End - 10));
                      if (group.length > 0) {
                        percentileGroups.push({ 
                          percentile: 'Top 75%', 
                          players: group,
                          startRank: top50End + 1,
                          endRank: top75End
                        });
                      }
                    }
                    
                    // Bottom 25% (ranks after top75End)
                    if (top75End < totalPlayers) {
                      const group = remaining.slice(Math.max(0, top75End - 10));
                      if (group.length > 0) {
                        percentileGroups.push({ 
                          percentile: 'Bottom 25%', 
                          players: group,
                          startRank: top75End + 1,
                          endRank: totalPlayers
                        });
                      }
                    }
                  }
                  
                  
                  return (
                    <div key={exercise.id} className="p-4 rounded-xl border bg-neutral-900 border-neutral-800">
                      <h4 className="font-bold text-neutral-300 text-sm mb-3">
                        {exercise.name}
                        <span className="text-neutral-500 text-xs ml-2">({exercise.dayTitle})</span>
                      </h4>
                      <div className="space-y-2">
                        {/* Top 10 players */}
                        {top10.map((rank, index) => {
                          const isSelectedPlayer = rank.playerId === selectedPlayer.id;
                          const rankNumber = index + 1;
                          
                          return (
                            <div
                              key={rank.playerId}
                              className={`p-2 rounded-lg border flex items-center justify-between ${
                                isSelectedPlayer
                                  ? 'bg-amber-500/20 border-amber-500/50'
                                  : 'bg-black/40 border-neutral-800/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  rankNumber === 1 ? 'bg-amber-500 text-black' :
                                  rankNumber === 2 ? 'bg-neutral-400 text-black' :
                                  rankNumber === 3 ? 'bg-amber-800 text-white' :
                                  'bg-neutral-800 text-neutral-400'
                                }`}>
                                  {rankNumber}
                                </div>
                                <span className={`text-sm ${isSelectedPlayer ? 'font-bold text-white' : 'text-neutral-300'}`}>
                                  {rank.playerName}
                                </span>
                              </div>
                              <span className={`font-mono font-bold text-sm ${
                                isSelectedPlayer ? 'text-amber-500' : 'text-neutral-400'
                              }`}>
                                {rank.displayValue}
                                {isSelectedPlayer && ` (#${rankNumber})`}
                              </span>
                            </div>
                          );
                        })}
                        
                        {/* Percentile groups */}
                        {percentileGroups.map((group, groupIndex) => {
                          const hasSelectedPlayer = group.players.some(p => p.playerId === selectedPlayer.id);
                          const selectedPlayerInGroup = group.players.find(p => p.playerId === selectedPlayer.id);
                          const selectedPlayerRank = selectedPlayerInGroup 
                            ? rankings.findIndex(r => r.playerId === selectedPlayer.id) + 1
                            : null;
                          
                          return (
                            <div key={groupIndex} className="mt-3 pt-3 border-t border-neutral-800">
                              <div className={`p-2 rounded-lg border ${
                                hasSelectedPlayer
                                  ? 'bg-amber-500/20 border-amber-500/50'
                                  : 'bg-black/40 border-neutral-800/50'
                              }`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-bold uppercase tracking-wider ${
                                    hasSelectedPlayer ? 'text-amber-500' : 'text-neutral-500'
                                  }`}>
                                    {group.percentile}
                                  </span>
                                  {hasSelectedPlayer && selectedPlayerInGroup && selectedPlayerRank && (
                                    <span className="font-mono font-bold text-xs text-amber-500">
                                      {selectedPlayerInGroup.displayValue} (#{selectedPlayerRank})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-500">
                                  Ranks {group.startRank}-{group.endRank} ({group.players.length} player{group.players.length !== 1 ? 's' : ''})
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachDashboard;