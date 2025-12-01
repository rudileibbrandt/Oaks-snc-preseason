import React, { useState, useEffect } from 'react';
import { Player, WorkoutLog, AppView } from '../types';
import { db } from '../services/db';
import { ChevronLeft, Download, Table } from 'lucide-react';
import { PROGRAM } from '../services/programData';
import { 
  getISOWeekFromTimestamp, 
  formatWeekIdentifier,
  WeekIdentifier
} from '../utils/weekUtils';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

const TrackerView: React.FC<Props> = ({ onNavigate }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      try {
        const playersData = await db.getPlayers();
        const logsData: WorkoutLog[] = [];
        
        // Get logs for all players
        for (const player of playersData) {
          const playerLogs = await db.getPlayerLogs(player.id);
          logsData.push(...playerLogs);
        }
        
        setPlayers(playersData);
        setAllLogs(logsData);
        setError(null);
      } catch (err: any) {
        console.error('Error loading tracker data:', err);
        setError(err.message || 'Failed to load data');
      }
    };

    loadData();
  }, []);

  // Get all unique weeks from logs
  const weekSet = new Set<string>();
  allLogs.forEach(log => {
    if (log.weekYear !== undefined && log.week !== undefined) {
      weekSet.add(`${log.weekYear}-W${log.week}`);
    } else if (log.weekNumber !== undefined) {
      const logWeek = getISOWeekFromTimestamp(log.timestamp);
      weekSet.add(`${logWeek.year}-W${logWeek.week}`);
    } else {
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

  // Filter to only players
  const playerPlayers = players.filter(p => p.role === 'Player');

  // Helper to get log for a player, week, and day
  const getLogForPlayerWeekDay = (playerId: string, week: WeekIdentifier, dayId: string): WorkoutLog | null => {
    return allLogs.find(log => {
      if (log.playerId !== playerId || log.dayId !== dayId) return false;
      if (log.weekYear !== undefined && log.week !== undefined) {
        return log.weekYear === week.year && log.week === week.week;
      }
      if (log.weekNumber !== undefined) {
        const logWeek = getISOWeekFromTimestamp(log.timestamp);
        return logWeek.year === week.year && logWeek.week === week.week;
      }
      const logWeek = getISOWeekFromTimestamp(log.timestamp);
      return logWeek.year === week.year && logWeek.week === week.week;
    }) || null;
  };

  // Helper to format cell value
  const getCellValue = (log: WorkoutLog | null): string => {
    if (!log || !log.data) return '';
    if (log.completed) {
      // Show key exercise data if available
      const day = PROGRAM.DAYS.find(d => d.id === log.dayId);
      if (day && day.exercises.length > 0) {
        const firstExercise = day.exercises[0];
        if (firstExercise.isSprint) {
          const time = log.data[`${firstExercise.id}_time`];
          return time ? `${time}s` : '✓';
        } else {
          const weight = log.data[`${firstExercise.id}_weight`];
          return weight ? `${weight}lbs` : '✓';
        }
      }
      return '✓';
    }
    return 'Partial';
  };

  // CSV Export function
  const exportToCSV = () => {
    const headers = ['Player', 'Position', ...weeks.flatMap(week => 
      PROGRAM.DAYS.map(day => `${formatWeekIdentifier(week)} ${day.title}`)
    )];
    
    const rows = playerPlayers.map(player => {
      const row = [player.name, player.position || ''];
      weeks.forEach(week => {
        PROGRAM.DAYS.forEach(day => {
          const log = getLogForPlayerWeekDay(player.id, week, day.id);
          row.push(getCellValue(log));
        });
      });
      return row;
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `workout-tracker-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => onNavigate('LANDING')}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-8">
      <button
        onClick={() => onNavigate('LANDING')}
        className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4"
      >
        <ChevronLeft size={20} />
        Back
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Table className="mr-3 text-amber-500" size={28} />
            Workout Tracker
          </h2>
          <p className="text-sm text-neutral-400 mt-1">Detailed spreadsheet view of all player workouts</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-xl">
        <div className="overflow-x-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-black text-neutral-200 uppercase tracking-wider font-bold sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-left sticky left-0 bg-black z-20 border-r border-neutral-800">Player</th>
                <th className="px-2 py-3 text-center sticky left-32 bg-black z-20 border-r border-neutral-800">Position</th>
                {weeks.map(week => (
                  PROGRAM.DAYS.map(day => (
                    <th key={`${week.year}-W${week.week}-${day.id}`} className="px-2 py-3 text-center border-r border-neutral-800 min-w-[80px]">
                      <div className="font-bold">{formatWeekIdentifier(week)}</div>
                      <div className="text-[10px] text-neutral-400 font-normal">{day.title}</div>
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {playerPlayers.length === 0 ? (
                <tr>
                  <td colSpan={2 + weeks.length * PROGRAM.DAYS.length} className="px-4 py-8 text-center text-neutral-500">
                    No players found
                  </td>
                </tr>
              ) : (
                playerPlayers.map((player, idx) => (
                <tr key={player.id} className={`border-b border-neutral-800 hover:bg-neutral-800/50 ${idx % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-900/50'}`}>
                  <td className="px-3 py-2 font-semibold text-white sticky left-0 bg-inherit z-10 border-r border-neutral-800">
                    {player.name}
                  </td>
                  <td className="px-2 py-2 text-center text-neutral-400 sticky left-32 bg-inherit z-10 border-r border-neutral-800">
                    {player.position || '-'}
                  </td>
                  {weeks.map(week => (
                    PROGRAM.DAYS.map(day => {
                      const log = getLogForPlayerWeekDay(player.id, week, day.id);
                      const cellValue = getCellValue(log);
                      const isComplete = log?.completed;
                      const isPartial = log && !log.completed;
                      
                      return (
                        <td 
                          key={`${player.id}-${week.year}-W${week.week}-${day.id}`}
                          className={`px-2 py-2 text-center border-r border-neutral-800 ${
                            isComplete ? 'bg-green-900/30 text-green-400' :
                            isPartial ? 'bg-amber-900/30 text-amber-400' :
                            'text-neutral-600'
                          }`}
                        >
                          {cellValue || '-'}
                        </td>
                      );
                    })
                  ))}
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrackerView;

