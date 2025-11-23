import React, { useState, useEffect } from 'react';
import { Player, WorkoutLog, AppView } from '../types';
import { db } from '../services/db';
import { Trash2, UserPlus, LogOut, Check, Trophy, Activity, X, ChevronRight, Dumbbell } from 'lucide-react';
import { PROGRAM } from '../services/programData';

interface Props {
  onNavigate: (view: AppView) => void;
}

const CoachDashboard: React.FC<Props> = ({ onNavigate }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPos, setNewPlayerPos] = useState<'Forward' | 'Back'>('Forward');
  
  // View States
  const [viewMode, setViewMode] = useState<'completion' | 'metrics'>('completion');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const p = await db.getPlayers();
    const l = await db.getLogs();
    setPlayers(p);
    setLogs(l);
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    await db.addPlayer(newPlayerName, newPlayerPos);
    setNewPlayerName('');
    loadData();
  };

  const handleRemovePlayer = async (id: string) => {
    if (confirm('Remove this player? Data will be preserved but they cannot log in.')) {
      await db.removePlayer(id);
      loadData();
    }
  };

  // Helper to check status
  const getStatus = (playerId: string, dayId: string) => {
    const log = logs.find(l => l.playerId === playerId && l.dayId === dayId);
    if (!log) return 'empty';
    return log.completed ? 'complete' : 'started';
  };

  // Helper to get specific lift weight
  const getLiftWeight = (playerId: string, exerciseId: string) => {
    // Find any log containing this exercise data
    // In this simple model, we search the specific day log, but simpler to search all player logs
    const playerLogs = logs.filter(l => l.playerId === playerId);
    for (const log of playerLogs) {
      if (log.data && log.data[`${exerciseId}_weight`]) {
        return log.data[`${exerciseId}_weight`] + 'kg';
      }
    }
    return '-';
  };

  const BIG_LIFTS = [
    { id: 'd1_1', label: 'Hex DL (D1)' },
    { id: 'd2_3', label: 'Inc Bench (D2)' },
    { id: 'd3_1', label: 'Squat (D3)' },
    { id: 'd3_2', label: 'H. Clean (D3)' },
  ];

  return (
    <div className="pb-20 animate-fade-in relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Trophy className="mr-2 text-emerald-500" />
          Team Leaderboard
        </h2>
        <button onClick={() => onNavigate('LANDING')} className="p-2 text-slate-400 hover:text-white">
          <LogOut size={20} />
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2 mb-6 p-1 bg-slate-800 rounded-lg inline-flex border border-slate-700">
        <button
          onClick={() => setViewMode('completion')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            viewMode === 'completion' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Completion
        </button>
        <button
          onClick={() => setViewMode('metrics')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            viewMode === 'metrics' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Performance Numbers
        </button>
      </div>

      {/* Main Table Area */}
      <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 mb-8 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-400">
            <thead className="bg-slate-900 text-slate-200 uppercase text-xs">
              <tr>
                <th className="px-4 py-4">Player</th>
                {viewMode === 'completion' ? (
                  <>
                    <th className="px-2 py-3 text-center">Day 1</th>
                    <th className="px-2 py-3 text-center">Day 2</th>
                    <th className="px-2 py-3 text-center">Day 3</th>
                    <th className="px-2 py-3 text-center">Day 4</th>
                  </>
                ) : (
                  BIG_LIFTS.map(lift => (
                    <th key={lift.id} className="px-2 py-3 text-center text-emerald-500">{lift.label}</th>
                  ))
                )}
                <th className="px-2 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {players.map(player => (
                <tr key={player.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-white cursor-pointer group" onClick={() => setSelectedPlayer(player)}>
                    <div className="flex items-center">
                      {player.name}
                      <Activity size={12} className="ml-2 text-slate-600 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  </td>
                  
                  {viewMode === 'completion' ? (
                    PROGRAM.DAYS.map(day => {
                      const status = getStatus(player.id, day.id);
                      return (
                        <td key={day.id} className="px-2 py-3 text-center">
                          <div className={`w-3 h-3 rounded-full mx-auto ${
                            status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                            status === 'started' ? 'bg-amber-500' :
                            'bg-slate-700'
                          }`} />
                        </td>
                      );
                    })
                  ) : (
                    BIG_LIFTS.map(lift => (
                      <td key={lift.id} className="px-2 py-3 text-center font-mono text-slate-300">
                        {getLiftWeight(player.id, lift.id)}
                      </td>
                    ))
                  )}

                  <td className="px-2 py-3 text-right">
                     <button onClick={() => setSelectedPlayer(player)} className="p-1 text-slate-500 hover:text-emerald-500">
                        <ChevronRight size={16} />
                     </button>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No players registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Roster Mgmt */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 opacity-80 hover:opacity-100 transition-opacity">
        <h3 className="font-bold text-white mb-4 flex items-center text-sm uppercase tracking-wide text-slate-400">
          <UserPlus size={16} className="mr-2" /> 
          Quick Add Player
        </h3>
        
        <form onSubmit={handleAddPlayer} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            placeholder="Player Name"
            className="flex-1 bg-slate-900 border border-slate-700 p-2 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
          />
          <select 
            value={newPlayerPos}
            onChange={(e: any) => setNewPlayerPos(e.target.value)}
            className="bg-slate-900 border border-slate-700 p-2 rounded text-white text-sm"
          >
            <option value="Forward">Fwd</option>
            <option value="Back">Back</option>
          </select>
          <button type="submit" className="bg-emerald-600 text-white p-2 rounded hover:bg-emerald-500">
            <Check size={18} />
          </button>
        </form>

        <div className="max-h-32 overflow-y-auto pr-2 custom-scrollbar">
           {players.length > 0 && (
             <div className="space-y-1">
              {players.map(player => (
                  <div key={player.id} className="flex justify-between items-center p-2 bg-slate-900/30 rounded border border-slate-700/30 hover:border-red-500/30 group">
                  <span className="text-slate-400 text-xs">{player.name}</span>
                  <button onClick={() => handleRemovePlayer(player.id)} className="text-slate-600 group-hover:text-red-500">
                      <Trash2 size={12} />
                  </button>
                  </div>
              ))}
             </div>
           )}
        </div>
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)} />
          <div className="relative w-full max-w-md bg-slate-900 h-full shadow-2xl border-l border-slate-700 overflow-y-auto animate-fade-in-right">
             
             <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-6 flex justify-between items-center z-10">
                <div>
                   <h3 className="text-2xl font-bold text-white">{selectedPlayer.name}</h3>
                   <p className="text-emerald-500 text-sm font-mono uppercase">{selectedPlayer.position}</p>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400">
                   <X size={20} />
                </button>
             </div>

             <div className="p-6 space-y-8">
                {PROGRAM.DAYS.map(day => {
                   const log = logs.find(l => l.playerId === selectedPlayer.id && l.dayId === day.id);
                   const hasData = log && Object.keys(log.data || {}).length > 0;

                   return (
                      <div key={day.id} className={`rounded-xl border ${hasData ? 'border-slate-700 bg-slate-800/50' : 'border-slate-800 bg-slate-900'}`}>
                         <div className="p-3 border-b border-slate-700/50 flex justify-between items-center">
                            <span className="font-bold text-slate-200">{day.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${log?.completed ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-600'}`}>
                               {log?.completed ? 'Complete' : 'Pending'}
                            </span>
                         </div>
                         
                         <div className="p-3 space-y-3">
                            {day.exercises.map(ex => {
                               if (!ex.isMetric) return null;
                               
                               const w = log?.data?.[`${ex.id}_weight`];
                               const s = log?.data?.[`${ex.id}_sets`];
                               const r = log?.data?.[`${ex.id}_reps`];
                               const hasEntry = w || s || r;

                               if (!hasEntry && !log) return null; // Don't show empty fields if no log at all

                               return (
                                  <div key={ex.id} className="flex justify-between items-center text-sm">
                                     <span className="text-slate-400 w-1/2 truncate pr-2">{ex.name}</span>
                                     <div className="flex space-x-2 font-mono text-xs">
                                        {hasEntry ? (
                                           <>
                                            <span className="text-emerald-400 bg-emerald-900/20 px-1.5 rounded">{w ? `${w}kg` : '-'}</span>
                                            <span className="text-slate-300 bg-slate-700 px-1.5 rounded">{s ? `${s}s` : '-'}</span>
                                            <span className="text-slate-300 bg-slate-700 px-1.5 rounded">{r ? `${r}r` : '-'}</span>
                                           </>
                                        ) : (
                                           <span className="text-slate-700">-</span>
                                        )}
                                     </div>
                                  </div>
                               );
                            })}
                            {!hasData && (
                               <div className="text-center py-2 text-xs text-slate-600 italic">
                                  No data recorded.
                               </div>
                            )}
                         </div>
                      </div>
                   );
                })}
             </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default CoachDashboard;