import React, { useMemo, useState, useEffect } from 'react';
import { Player, WorkoutLog } from '../types';
import { ADVANCED_WEEKS, getAdvancedWeek, ADVANCED_FIRST_WEEK, ADVANCED_LAST_WEEK } from '../services/programData';
import {
  HEADLINE_LIFTS, TIMED_TESTS, LiftKey, PlayerStats, advancedPlayers, computePlayerStats, dayStatus,
  isSessionDay, formatSeconds, compareByCompletionThenLoad, avgWeeklyLoad, describeEntry, latestLogForDay,
} from '../services/advancedStats';
import { compareWeekIdentifiers, WeekIdentifier } from '../utils/weekUtils';
import { Trophy, AlertCircle, X, TrendingUp, Users, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export type StatView = 'completion' | 'metrics' | 'analytics' | 'performers';

interface Props {
  players: Player[];
  allLogs: WorkoutLog[];
  selectedWeek: WeekIdentifier;
  onSelectWeek: (week: WeekIdentifier) => void;
  currentPlayer?: Player | null;
  viewMode: StatView;
}

interface Row {
  player: Player;
  logs: WorkoutLog[];
  stats: PlayerStats;
}

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const TOOLTIP_STYLE = { backgroundColor: '#171717', border: '1px solid #404040', borderRadius: '8px', color: '#fff' };

const rateColor = (rate: number | null) =>
  rate === null ? 'text-neutral-500' : rate >= 80 ? 'text-green-500' : rate >= 60 ? 'text-amber-500' : 'text-red-500';

const AdvancedStatBoard: React.FC<Props> = ({ players, allLogs, selectedWeek, onSelectWeek, currentPlayer, viewMode }) => {
  const isCoach = currentPlayer?.role === 'Coach';
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [chartPlayerId, setChartPlayerId] = useState<string>('');
  const [chartLift, setChartLift] = useState<LiftKey>('frontSquat');
  const today = todayIso();

  // Players see the board for themselves.
  useEffect(() => {
    if (!isCoach && currentPlayer) setChartPlayerId(currentPlayer.id);
  }, [isCoach, currentPlayer]);

  // Players only see other players; coaches see everyone on the Advanced program.
  const rows: Row[] = useMemo(() => {
    const visible = isCoach ? players : players.filter(p => p.role === 'Player');
    return advancedPlayers(visible, allLogs)
      .map(player => {
        const logs = allLogs.filter(l => l.playerId === player.id);
        return { player, logs, stats: computePlayerStats(logs, today) };
      })
      .sort((a, b) => compareByCompletionThenLoad(a.stats, b.stats));
  }, [players, allLogs, isCoach, today]);

  const programWeek = getAdvancedWeek(selectedWeek);
  const isBefore = compareWeekIdentifiers(selectedWeek, ADVANCED_FIRST_WEEK) < 0;

  // Team completion per program week (players only), for weeks that have started.
  const teamCompletion = useMemo(() => ADVANCED_WEEKS
    .map(w => {
      const squad = rows.filter(r => r.player.role === 'Player');
      const due = w.days.filter(d => isSessionDay(d) && d.date && d.date <= today);
      const possible = due.length * squad.length;
      const done = squad.reduce((sum, r) =>
        sum + due.filter(d => latestLogForDay(r.logs, d.id)?.completed).length, 0);
      return { week: `W${w.week}`, possible, completionRate: possible > 0 ? Math.round((done / possible) * 100) : 0 };
    })
    .filter(w => w.possible > 0), [rows, today]);

  const chartRow = rows.find(r => r.player.id === chartPlayerId);
  const chartData = chartRow ? ADVANCED_WEEKS.map(w => ({
    week: `W${w.week}`,
    weight: chartRow.stats.bestLiftByWeek[w.week]?.[chartLift] ?? null,
    load: Math.round(chartRow.stats.loadByWeek[w.week] ?? 0),
  })) : [];

  // Performers ranks players only, once the program has started.
  const ranked = rows.filter(r => r.player.role === 'Player' && r.stats.completionRate !== null);
  const top = ranked.slice(0, 10);
  const bottom = ranked.slice(-10).reverse(); // like the Intermediate board, overlaps Top 10 when the squad is small

  const emptyNote = (
    <div className="p-8 text-center text-neutral-500 text-sm">
      No players on the Advanced program yet. Players switch from their dashboard.
    </div>
  );

  const outsideProgram = (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 text-center mb-8">
      <h3 className="text-lg font-bold text-white mb-2">No Advanced sessions this week</h3>
      <p className="text-sm text-neutral-400 mb-4">The Advanced program runs Mon 2 Nov – Sun 20 Dec 2026.</p>
      <button
        onClick={() => onSelectWeek(isBefore ? ADVANCED_FIRST_WEEK : ADVANCED_LAST_WEEK)}
        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg transition-colors"
      >
        {isBefore ? 'Go to Week 1' : 'Go to Week 7'}
      </button>
    </div>
  );

  const playerCell = (player: Player) => (
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
  );

  const rankCell = (index: number) => (
    <td className="px-2 py-2 text-center font-bold text-neutral-400 sticky left-0 bg-neutral-900/95 z-10">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mx-auto ${
        index === 0 ? 'bg-amber-500 text-black' : index === 1 ? 'bg-neutral-400 text-black' :
        index === 2 ? 'bg-amber-800 text-white' : 'bg-neutral-800 text-neutral-400'
      }`}>{index + 1}</div>
    </td>
  );

  const completionCell = (s: PlayerStats) => (
    <td className="px-2 py-2 text-center">
      <div className={`text-xs font-bold ${rateColor(s.completionRate)}`}>
        {s.completionRate === null ? '–' : `${s.completionRate}%`}
      </div>
    </td>
  );

  // ---------- Workouts Completed / Best tables ----------
  const table = (viewMode === 'completion' || viewMode === 'metrics') && (
    viewMode === 'completion' && !programWeek ? outsideProgram : (
      <div className="bg-neutral-900/50 rounded-xl overflow-hidden border border-neutral-800 mb-8 shadow-xl">
        {viewMode === 'completion' && programWeek && (
          <div className="px-4 py-3 border-b border-neutral-800 text-xs font-bold uppercase tracking-wider text-amber-500">
            Week {programWeek.week} · {programWeek.phase}
          </div>
        )}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left text-neutral-400 min-w-max">
            <thead className="bg-black text-neutral-200 uppercase text-[10px] tracking-wider font-bold sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-neutral-500 sticky left-0 bg-black z-20">Rank</th>
                <th className="px-2 py-2 text-neutral-500 sticky left-8 bg-black z-20">Player</th>
                {viewMode === 'completion' && programWeek
                  ? programWeek.days.map(d => (
                      <th key={d.id} className={`px-2 py-3 text-center ${isSessionDay(d) ? '' : 'text-neutral-600'}`}>
                        {d.title.split(' ')[0]}
                      </th>
                    ))
                  : (
                    <>
                      {HEADLINE_LIFTS.map(l => <th key={l.key} className="px-2 py-3 text-center text-amber-500">{l.label}</th>)}
                      {TIMED_TESTS.map(t => <th key={t.key} className="px-2 py-3 text-center text-amber-500">{t.label}</th>)}
                      <th className="px-2 py-3 text-center text-amber-500">Run Miles</th>
                    </>
                  )}
                <th className="px-2 py-3 text-center text-amber-500">Completion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ player, logs, stats }, index) => (
                <tr key={player.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  {rankCell(index)}
                  {playerCell(player)}
                  {viewMode === 'completion' && programWeek
                    ? programWeek.days.map(d => {
                        const status = dayStatus(d, latestLogForDay(logs, d.id));
                        return (
                          <td key={d.id} className="px-2 py-2 text-center">
                            {status === 'rest' ? (
                              <span className="text-neutral-700">–</span>
                            ) : (
                              <div className={`w-3 h-3 rounded-sm rotate-45 mx-auto ${
                                status === 'complete' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                                status === 'partial' ? 'bg-amber-500' : 'bg-transparent border border-neutral-800'
                              }`} />
                            )}
                          </td>
                        );
                      })
                    : (
                      <>
                        {HEADLINE_LIFTS.map(l => (
                          <td key={l.key} className="px-2 py-2 text-center font-mono text-white font-bold text-xs">
                            {stats.bestLift[l.key] ? `${stats.bestLift[l.key]}lbs` : '-'}
                          </td>
                        ))}
                        {TIMED_TESTS.map(t => (
                          <td key={t.key} className="px-2 py-2 text-center font-mono text-white font-bold text-xs">
                            {stats.bestTest[t.key] !== undefined ? formatSeconds(stats.bestTest[t.key]!) : '-'}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center font-mono text-white font-bold text-xs">
                          {stats.runMiles > 0 ? stats.runMiles : '-'}
                        </td>
                      </>
                    )}
                  {completionCell(stats)}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && emptyNote}
        </div>
      </div>
    )
  );

  // ---------- Analytics ----------
  const analytics = viewMode === 'analytics' && (
    <div className="space-y-6 mb-8">
      {isCoach && (
        <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Users className="mr-2 text-amber-500" size={20} />
            Team Completion by Program Week
          </h3>
          {teamCompletion.length === 0 ? (
            <p className="text-sm text-neutral-500">Shows once the program starts on Mon 2 Nov.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={teamCompletion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, 'Completion']} />
                <Bar dataKey="completionRate" radius={[8, 8, 0, 0]}>
                  {teamCompletion.map((e, i) => (
                    <Cell key={i} fill={e.completionRate >= 80 ? '#10b981' : e.completionRate >= 60 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {isCoach && (
          <select
            value={chartPlayerId}
            onChange={e => setChartPlayerId(e.target.value)}
            className="bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
          >
            <option value="">Select a player...</option>
            {rows.filter(r => r.player.role === 'Player').map(r => (
              <option key={r.player.id} value={r.player.id}>{r.player.name}</option>
            ))}
          </select>
        )}
        <select
          value={chartLift}
          onChange={e => setChartLift(e.target.value as LiftKey)}
          className="bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
        >
          {HEADLINE_LIFTS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
        </select>
      </div>

      {chartRow ? (
        <>
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <TrendingUp className="mr-2 text-amber-500" size={20} />
              {chartRow.player.name} – {HEADLINE_LIFTS.find(l => l.key === chartLift)!.label}
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} lbs`, 'Best']} />
                <Line type="monotone" dataKey="weight" stroke="#f59e0b" strokeWidth={2} connectNulls dot={{ fill: '#f59e0b', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center">
              <Activity className="mr-2 text-amber-500" size={20} />
              {chartRow.player.name} – Weekly Training Load
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Minutes × effort, added up over runs, recovery and Team Training. Lifting isn't timed, so it isn't included.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [v, 'Load']} />
                <Bar dataKey="load" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="text-sm text-neutral-500">
          {isCoach ? 'Pick a player to see their progress.' : 'Switch to the Advanced program to see your progress here.'}
        </p>
      )}
    </div>
  );

  // ---------- Performers (coaches only) ----------
  const performerList = (list: Row[], tone: 'top' | 'bottom') => (
    list.length === 0 ? <div className="text-center py-12 text-neutral-500">No data available yet</div> : (
      <div className="space-y-3">
        {list.map(({ player, stats }, index) => (
          <div
            key={player.id}
            onClick={() => setSelectedPlayer(player)}
            className={`flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl border border-neutral-700 transition-colors cursor-pointer ${
              tone === 'top' ? 'hover:border-amber-500/50' : 'hover:border-red-500/50'
            }`}
          >
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mr-4 ${
                tone === 'top' && index === 0 ? 'bg-amber-500 text-black' : 'bg-neutral-700 text-neutral-300'
              }`}>
                {tone === 'top' ? index + 1 : ranked.length - index}
              </div>
              <div>
                <div className="font-bold text-white">{player.name}</div>
                <div className="text-xs text-neutral-500">{player.position || 'No position'}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${tone === 'top' ? 'text-amber-500' : 'text-red-500'}`}>
                {stats.completionRate}% complete
              </div>
              <div className="text-xs text-neutral-500">{stats.sessionsDone}/{stats.sessionsScheduled} sessions</div>
              <div className="text-xs text-neutral-500">Avg weekly load {avgWeeklyLoad(stats)}</div>
            </div>
          </div>
        ))}
      </div>
    )
  );

  const performers = viewMode === 'performers' && isCoach && (
    <div className="space-y-6 mb-8">
      <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-xl">
        <div className="p-6 bg-gradient-to-r from-amber-500/20 to-amber-500/10 border-b border-amber-500/30">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Trophy className="mr-3 text-amber-500" size={28} /> Top 10
          </h2>
          <p className="text-sm text-neutral-400 mt-2">Ranked by sessions completed, then total training load</p>
        </div>
        <div className="p-6">{performerList(top, 'top')}</div>
      </div>
      <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-xl">
        <div className="p-6 bg-gradient-to-r from-red-500/20 to-red-500/10 border-b border-red-500/30">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <AlertCircle className="mr-3 text-red-500" size={28} /> Bottom 10
          </h2>
          <p className="text-sm text-neutral-400 mt-2">Fewest sessions completed, then lowest training load</p>
        </div>
        <div className="p-6">{performerList(bottom, 'bottom')}</div>
      </div>
    </div>
  );

  // ---------- Player detail ----------
  const detailWeek = programWeek ?? ADVANCED_WEEKS[0];
  const detailLogs = selectedPlayer ? allLogs.filter(l => l.playerId === selectedPlayer.id) : [];
  const detail = selectedPlayer && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)}>
      <div className="bg-neutral-900 w-full max-w-2xl max-h-[80vh] rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-black/40">
          <div>
            <h3 className="text-2xl font-black text-white italic">{selectedPlayer.name}</h3>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest">
              Advanced · Week {detailWeek.week} · {detailWeek.phase}
            </p>
          </div>
          <button onClick={() => setSelectedPlayer(null)} className="text-neutral-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
          {detailWeek.days.filter(isSessionDay).map(day => {
            const log = latestLogForDay(detailLogs, day.id);
            const status = dayStatus(day, log);
            return (
              <div key={day.id} className={`p-4 rounded-xl border ${status === 'complete' ? 'bg-neutral-900/50 border-green-900/30' : 'bg-neutral-900 border-neutral-800'}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-neutral-300 text-sm uppercase">{day.title}: {day.focus}</h4>
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded tracking-wider ${
                    status === 'complete' ? 'bg-green-900/20 text-green-500' :
                    status === 'partial' ? 'bg-amber-900/20 text-amber-500' : 'bg-neutral-800 text-neutral-500'
                  }`}>
                    {status === 'complete' ? 'Complete' : status === 'partial' ? 'Started' : 'Not logged'}
                  </span>
                </div>
                <div className="space-y-1">
                  {day.exercises.map(ex => {
                    const entry = log?.data ? describeEntry(ex, log.data) : undefined;
                    return (
                      <div key={ex.id} className="flex justify-between text-xs gap-4">
                        <span className="text-neutral-400">{ex.group ? `${ex.group}  ` : ''}{ex.name}</span>
                        <span className={`font-mono ${entry ? 'text-white' : 'text-neutral-600'}`}>{entry ?? '–'}</span>
                      </div>
                    );
                  })}
                  {log?.customWorkout && (
                    <div className="text-xs text-neutral-400 mt-2">Own workout: {log.customWorkout}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {table}
      {analytics}
      {performers}
      {detail}
    </>
  );
};

export default AdvancedStatBoard;
