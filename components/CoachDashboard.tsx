import React, { useState, useEffect } from 'react';
import { Player, WorkoutLog, AppView } from '../types';
import { db } from '../services/db';
import { Trash2, UserPlus, LogOut, Check, Trophy, X, ChevronRight } from 'lucide-react';
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
    const playerLogs = logs.filter(l => l.playerId === playerId);
    for (const log of playerLogs) {
      if (log.data && log.data[`${exerciseId}_weight`]) {
        return log.data[`${exerciseId}_weight`] + 'kg';
      }
    }
    return '-';
  };

  const BIG_LIFTS = [
    { id: 'd1_1', label: 'Hex DL' },
    { id: 'd2_3', label: 'Incline' },
    { id: 'd3_1', label: 'Squat' },
    { id: 'd3_2', label: 'Clean' },
  ];

  return (
    <div className="pb-20 animate-fade-in relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center tracking-tight">
            <Trophy className="mr-2 text-amber-500" fill="currentColor" />
            LEADERBOARD
          </h2>
          <p className="text-neutral-500 text-xs uppercase tracking-widest ml-1">Team Performance</p>
        </div>
        <button onClick={() => onNavigate('LANDING')} className="p-2 text-neutral-400 hover:text-white bg-neutral-900 rounded-lg border border-neutral-800">
          <LogOut size={20} />
        </button>
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
          Max Lifts
        </button>
      </div>

      {/* Main Table Area */}
      <div className="bg-neutral-900/50 rounded-xl overflow-hidden border border-neutral-800 mb-8 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-neutral-400">
            <thead className="bg-black text-neutral-200 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="px-4 py-4 text-neutral-500">Player</th>
                {viewMode === 'completion' ? (
                  <>
                    <th className="px-2 py-3 text-center">D1</th>
                    <th className="px-2 py-3 text-center">D2</th>
                    <th className="px-2 py-3 text-center">D3</th>
                    <th className="px-2 py-3 text-center">D4</th>
                  </>
                ) : (
                  BIG_LIFTS.map(lift => (
                    <th key={lift.id} className="px-2 py-3 text-center text-amber-500">{lift.label}</th>
                  ))
                )}
                <th className="px-2 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {players.map(player => (
                <tr key={player.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white cursor-pointer group" onClick={() => setSelectedPlayer(player)}>
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center mr-3 text-xs font-bold text-neutral-500 border border-neutral-700">
                        {player.name.charAt(0)}
                      </div>
                      <div>
                        <div className="group-hover:text-amber-500 transition-colors">{player.name}</div>
                        <div className="text-[10px] text-neutral-600 uppercase">{player.position}</div>
                      </div>
                    </div>
                  </td>
                  
                  {viewMode === 'completion' ? (
                    PROGRAM.DAYS.map(day => {
                      const status = getStatus(player.id, day.id);
                      return (
                        <td key={day.id} className="px-2 py-3 text-center">
                          <div className={`w-3 h-3 rounded-sm rotate-45 mx-auto transition-all ${
                            status === 'complete' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                            status === 'started' ? 'bg-amber-500' :
                            'bg-neutral-800'
                          }`} />
                        </td>
                      );
                    })
                  ) : (
                    BIG_LIFTS.map(lift => (
                      <td key={lift.id} className="px-2 py-3 text-center font-mono text-white font-bold">
                        {getLiftWeight(player.id, lift.id)}
                      </td>
                    ))
                  )}

                  <td className="px-2 py-3 text-right">
                     <button onClick={() => setSelectedPlayer(player)} className="p-1 text-neutral-600 hover:text-amber-500">
                        <ChevronRight size={16} />
                     </button>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-500">No players registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Roster Mgmt */}
      <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
        <h3 className="font-bold text-white mb-4 flex items-center text-xs uppercase tracking-wide">
          <UserPlus size={14} className="mr-2 text-amber-500" /> 
          Quick Add Player
        </h3>
        
        <form onSubmit={handleAddPlayer} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            placeholder="Player Name"
            className="flex-1 bg-black border border-neutral-800 p-3 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
          />
          <select 
            value={newPlayerPos}
            onChange={(e: any) => setNewPlayerPos(e.target.value)}
            className="bg-black border border-neutral-800 p-3 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="Forward">Fwd</option>
            <option value="Back">Back</option>
          </select>
          <button type="submit" className="bg-amber-500 text-black p-3 rounded-lg hover:bg-amber-400 shadow-lg shadow-amber-900/20">
            <Check size={18} />
          </button>
        </form>

        <div className="max-h-32 overflow-y-auto pr-2 custom-scrollbar space-y-2">
           {players.length > 0 && players.map(player => (
              <div key={player.id} className="flex justify-between items-center p-2 bg-black/50 rounded border border-neutral-800 hover:border-amber-500/50 group transition-colors">
                <span className="text-neutral-400 text-xs font-medium">{player.name}</span>
                <button onClick={() => handleRemovePlayer(player.id)} className="text-neutral-600 group-hover:text-amber-500">
                    <Trash2 size={12} />
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedPlayer(null)} />
          <div className="relative w-full max-w-md bg-neutral-950 h-full shadow-2xl border-l border-neutral-800 overflow-y-auto animate-slide-in">
             
             <div className="sticky top-0 bg-neutral-950/95 backdrop-blur border-b border-neutral-800 p-6 flex justify-between items-center z-10">
                <div>
                   <h3 className="text-2xl font-black text-white tracking-tight">{selectedPlayer.name}</h3>
                   <span className="inline-block bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase mt-1">{selectedPlayer.position}</span>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 text-neutral-400">
                   <X size={20} />
                </button>
             </div>

             <div className="p-6 space-y-6">
                {PROGRAM.DAYS.map(day => {
                   const log = logs.find(l => l.playerId === selectedPlayer.id && l.dayId === day.id);
                   const hasData = log && Object.keys(log.data || {}).length > 0;

                   return (
                      <div key={day.id} className={`rounded-xl border ${hasData ? 'border-neutral-700 bg-neutral-900/30' : 'border-neutral-800 bg-black'}`}>
                         <div className="p-3 border-b border-neutral-800 flex justify-between items-center">
                            <span className="font-bold text-neutral-200">{day.title}</span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${log?.completed ? 'bg-green-500/10 text-green-500' : 'text-neutral-600 bg-neutral-900'}`}>
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

                               if (!hasEntry && !log) return null;

                               return (
                                  <div key={ex.id} className="flex justify-between items-center text-sm">
                                     <span className="text-neutral-400 w-1/2 truncate pr-2">{ex.name}</span>
                                     <div className="flex space-x-2 font-mono text-xs">
                                        {hasEntry ? (
                                           <>
                                            <span className="text-white bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 min-w-[3rem] text-center">{w ? `${w}kg` : '-'}</span>
                                            <span className="text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded min-w-[2rem] text-center">{s ? `${s}s` : '-'}</span>
                                            <span className="text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded min-w-[2rem] text-center">{r ? `${r}r` : '-'}</span>
                                           </>
                                        ) : (
                                           <span className="text-neutral-700">-</span>
                                        )}
                                     </div>
                                  </div>
                               );
                            })}
                            {!hasData && (
                               <div className="text-center py-4 text-xs text-neutral-700 italic">
                                  No workout data logged yet.
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