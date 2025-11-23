import React, { useState, useEffect } from 'react';
import { Player, WorkoutLog, AppView } from '../types';
import { db } from '../services/db';
import { Trash2, UserPlus, LogOut, Trophy, ChevronRight, AlertCircle, Loader2, X } from 'lucide-react';
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
  
  // Async states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const p = await db.getPlayers();
      const l = await db.getLogs();
      setPlayers(p);
      setLogs(l);
    } catch (e: any) {
      console.error("Load failed", e);
      if (e.code === 'permission-denied') {
        setError("Database Permission Denied. Run: firebase deploy --only firestore:rules");
      }
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await db.addPlayer(newPlayerName, newPlayerPos);
      setNewPlayerName('');
      loadData();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
         setError("Permission denied. Check Firestore Rules in Firebase Console.");
      } else {
         setError(err.message || "Failed to add player");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePlayer = async (id: string) => {
    if (confirm('Remove this player? Data will be preserved but they cannot log in.')) {
      try {
        await db.removePlayer(id);
        loadData();
      } catch (err) {
        alert("Failed to remove player. Check console.");
      }
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

      {error && (
            <div className="mb-6 bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-start text-red-500 text-sm">
              <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
      )}

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
            disabled={isSubmitting}
            className="flex-1 bg-black border border-neutral-800 p-3 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
          />
          <select 
            value={newPlayerPos}
            onChange={(e: any) => setNewPlayerPos(e.target.value)}
            disabled={isSubmitting}
            className="bg-black border border-neutral-800 p-3 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
          >
            <option value="Forward">Fwd</option>
            <option value="Back">Back</option>
          </select>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-amber-500 text-black p-3 rounded-lg hover:bg-amber-400 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed w-12 flex justify-center items-center"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Trophy size={18} />}
          </button>
        </form>

        <div className="max-h-32 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {players.map(p => (
                <div key={p.id} className="flex justify-between items-center p-2 bg-black/40 rounded border border-neutral-800/50">
                    <span className="text-xs text-neutral-400">{p.name} ({p.position})</span>
                    <button 
                        onClick={() => handleRemovePlayer(p.id)}
                        className="text-neutral-600 hover:text-red-500"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
        </div>
      </div>
      
      {/* Player Details Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)}>
          <div className="bg-neutral-900 w-full max-w-lg max-h-[80vh] rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-black/40">
              <div>
                <h3 className="text-2xl font-black text-white italic">{selectedPlayer.name}</h3>
                <p className="text-amber-500 text-xs font-bold uppercase tracking-widest">{selectedPlayer.position}</p>
              </div>
              <button onClick={() => setSelectedPlayer(null)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {PROGRAM.DAYS.map(day => {
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
                    
                    {dayLog && dayLog.data && (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(dayLog.data).map(([key, val]) => {
                           const [exId, type] = key.split('_');
                           if (!val) return null;
                           const exName = day.exercises.find(e => e.id === exId)?.name || exId;
                           return (
                             <div key={key} className="text-xs bg-black/40 p-2 rounded border border-neutral-800/50 flex justify-between">
                               <span className="text-neutral-500 mr-2">{exName} ({type}):</span>
                               <span className="font-mono text-amber-500 font-bold">{val}</span>
                             </div>
                           );
                        })}
                      </div>
                    )}
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