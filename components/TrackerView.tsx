import React, { useState, useEffect, useMemo, useRef } from 'react';
import { thisSeasonOnly } from '../services/season';
import { Player, WorkoutLog, AppView, ProgramLevel } from '../types';
import { db } from '../services/db';
import { ChevronLeft, Download, Table } from 'lucide-react';
import { PROGRAM, ADVANCED_WEEKS } from '../services/programData';
import { isAlumni } from '../services/alumni';
import { advancedPlayers, isAdvancedLog, isSessionDay, latestLogForDay, trackerCell, dayStatus } from '../services/advancedStats';
import {
  getISOWeekFromTimestamp,
  formatWeekIdentifier,
  WeekIdentifier
} from '../utils/weekUtils';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

// One column of the tracker: a header and how to fill it for a player.
interface Column {
  key: string;
  title: string; // first header line, e.g. "2026-W45" or "W1"
  subtitle: string; // second header line, e.g. "Day 1" or "Mon 2 Nov"
  cell: (playerId: string) => { text: string; status: 'complete' | 'partial' | 'empty' };
}

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const TrackerView: React.FC<Props> = ({ onNavigate, currentPlayer }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Which program's tracker is showing; opens on the viewer's own program.
  const [program, setProgram] = useState<ProgramLevel>(currentPlayer?.program ?? 'Intermediate');
  const pickedProgramRef = useRef(false);

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
        setAllLogs(thisSeasonOnly(logsData)); // this season only
        setError(null);
      } catch (err: any) {
        console.error('[TrackerView] Error loading tracker data:', err);
        setError(err.message || 'Failed to load data');
      }
    };

    loadData();
  }, []);

  // The app's currentPlayer can predate a program switch, so default from the loaded roster.
  useEffect(() => {
    if (pickedProgramRef.current || !currentPlayer) return;
    const me = players.find(p => p.id === currentPlayer.id);
    if (me) setProgram(me.program ?? 'Intermediate');
  }, [players, currentPlayer]);

  // ---------- Intermediate: weeks that have logs × the 4 days ----------
  const intermediate = useMemo(() => {
    const rows = players.filter(p => p.role === 'Player' && !isAlumni(p) && p.program !== 'Advanced');
    // Only these players' logs make columns, so alumni history doesn't add empty weeks.
    const rowIds = new Set(rows.map(p => p.id));
    const logs = allLogs.filter(l => !isAdvancedLog(l) && rowIds.has(l.playerId));
    const weekOf = (log: WorkoutLog): WeekIdentifier =>
      log.weekYear !== undefined && log.week !== undefined
        ? { year: log.weekYear, week: log.week }
        : getISOWeekFromTimestamp(log.timestamp);

    const weekSet = new Set(logs.map(l => formatWeekIdentifier(weekOf(l))));
    const weeks: WeekIdentifier[] = Array.from(weekSet).map(weekStr => {
      const [year, weekPart] = weekStr.split('-W');
      return { year: parseInt(year), week: parseInt(weekPart) };
    }).sort((a, b) => a.year - b.year || a.week - b.week);

    // Short text for a logged day: the first exercise's weight or sprint time.
    const cellText = (log: WorkoutLog): string => {
      if (!log.data) return '';
      if (!log.completed) return 'Partial';
      const day = PROGRAM.DAYS.find(d => d.id === log.dayId);
      const first = day?.exercises[0];
      if (!first) return '✓';
      if (first.isSprint) {
        const time = log.data[`${first.id}_time`];
        return time ? `${time}s` : '✓';
      }
      const weight = log.data[`${first.id}_weight`];
      return weight ? `${weight}lbs` : '✓';
    };

    const columns: Column[] = weeks.flatMap(week => PROGRAM.DAYS.map(day => ({
      key: `${formatWeekIdentifier(week)}-${day.id}`,
      title: formatWeekIdentifier(week),
      subtitle: day.title,
      cell: (playerId: string) => {
        const wk = formatWeekIdentifier(week);
        const log = logs.find(l => l.playerId === playerId && l.dayId === day.id && formatWeekIdentifier(weekOf(l)) === wk);
        if (!log) return { text: '', status: 'empty' as const };
        return { text: cellText(log), status: log.completed ? 'complete' as const : 'partial' as const };
      },
    })));

    return { columns, rows };
  }, [allLogs, players]);

  // ---------- Advanced: every session day of the weeks that have started ----------
  const advanced = useMemo(() => {
    const today = todayIso();
    const started = ADVANCED_WEEKS.filter(w => w.startDate <= today);
    const shownWeeks = started.length > 0 ? started : ADVANCED_WEEKS.slice(0, 1);
    const logsByPlayer = new Map<string, WorkoutLog[]>();
    for (const log of allLogs) {
      if (!isAdvancedLog(log)) continue;
      logsByPlayer.set(log.playerId, [...(logsByPlayer.get(log.playerId) ?? []), log]);
    }

    const columns: Column[] = shownWeeks.flatMap(w => w.days.filter(isSessionDay).map(day => ({
      key: day.id,
      title: `W${w.week}`,
      subtitle: day.title,
      cell: (playerId: string) => {
        const log = latestLogForDay(logsByPlayer.get(playerId) ?? [], day.id);
        const status = dayStatus(day, log);
        return {
          text: trackerCell(day, log),
          status: status === 'complete' ? 'complete' as const : status === 'partial' ? 'partial' as const : 'empty' as const,
        };
      },
    })));

    const rows = advancedPlayers(players, allLogs).filter(p => p.role === 'Player' && !isAlumni(p));
    return { columns, rows };
  }, [allLogs, players]);

  const { columns, rows: playerRows } = program === 'Advanced' ? advanced : intermediate;

  // CSV Export function
  const exportToCSV = () => {
    const headers = ['Player', 'Position', ...columns.map(c => `${c.title} ${c.subtitle}`)];
    const rows = playerRows.map(player => [
      player.name,
      player.position || '',
      ...columns.map(c => c.cell(player.id).text),
    ]);

    // Create CSV content (escape embedded quotes)
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `workout-tracker-${program.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
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

      {/* Program Toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
        {(['Intermediate', 'Advanced'] as ProgramLevel[]).map(level => (
          <button
            key={level}
            onClick={() => { pickedProgramRef.current = true; setProgram(level); }}
            className={`py-2 rounded-lg text-sm font-bold transition-all ${
              program === level ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-xl">
        <div className="overflow-x-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-black text-neutral-200 uppercase tracking-wider font-bold sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-left sticky left-0 bg-black z-20 border-r border-neutral-800">Player</th>
                <th className="px-2 py-3 text-center sticky left-32 bg-black z-20 border-r border-neutral-800">Position</th>
                {columns.map(col => (
                  <th key={col.key} className="px-2 py-3 text-center border-r border-neutral-800 min-w-[80px]">
                    <div className="font-bold">{col.title}</div>
                    <div className="text-[10px] text-neutral-400 font-normal">{col.subtitle}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playerRows.length === 0 ? (
                <tr>
                  <td colSpan={2 + columns.length} className="px-4 py-8 text-center text-neutral-500">
                    {program === 'Advanced' ? 'No players on the Advanced program yet' : 'No players found'}
                  </td>
                </tr>
              ) : (
                playerRows.map((player, idx) => (
                <tr key={player.id} className={`border-b border-neutral-800 hover:bg-neutral-800/50 ${idx % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-900/50'}`}>
                  <td className="px-3 py-2 font-semibold text-white sticky left-0 bg-inherit z-10 border-r border-neutral-800">
                    {player.name}
                  </td>
                  <td className="px-2 py-2 text-center text-neutral-400 sticky left-32 bg-inherit z-10 border-r border-neutral-800">
                    {player.position || '-'}
                  </td>
                  {columns.map(col => {
                    const { text, status } = col.cell(player.id);
                    return (
                      <td
                        key={`${player.id}-${col.key}`}
                        className={`px-2 py-2 text-center border-r border-neutral-800 whitespace-nowrap ${
                          status === 'complete' ? 'bg-green-900/30 text-green-400' :
                          status === 'partial' ? 'bg-amber-900/30 text-amber-400' :
                          'text-neutral-600'
                        }`}
                      >
                        {text || '-'}
                      </td>
                    );
                  })}
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
