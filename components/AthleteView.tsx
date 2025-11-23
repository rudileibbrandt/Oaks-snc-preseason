import React, { useState, useEffect } from 'react';
import { Player, WorkoutLog, AppView } from '../types';
import { db } from '../services/db';
import { PROGRAM } from '../services/programData';
import { ChevronLeft, CheckCircle2, User, ChevronRight, Plus } from 'lucide-react';
import WorkoutSession from './WorkoutSession';

interface Props {
  onNavigate: (view: AppView) => void;
}

const AthleteView: React.FC<Props> = ({ onNavigate }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerLogs, setPlayerLogs] = useState<WorkoutLog[]>([]);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Registration State
  const [isRegistering, setIsRegistering] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState<'Forward' | 'Back'>('Forward');

  useEffect(() => {
    loadPlayers();
  }, []);

  useEffect(() => {
    if (selectedPlayer) {
      loadLogs(selectedPlayer.id);
    }
  }, [selectedPlayer, activeDayId]); // Reload logs if activeDayId changes (implies return from workout)

  const loadPlayers = async () => {
    setPlayers(await db.getPlayers());
  };

  const loadLogs = async (id: string) => {
    setPlayerLogs(await db.getPlayerLogs(id));
  };

  const isDayComplete = (dayId: string) => {
    return playerLogs.some(l => l.dayId === dayId && l.completed);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    // Add player and immediately select them
    const newPlayer = await db.addPlayer(newName, newPos);
    setPlayers(prev => [...prev, newPlayer]);
    setSelectedPlayer(newPlayer);
    setIsRegistering(false);
    setNewName(''); // Reset form
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // VIEW 1: REGISTRATION FORM
  if (isRegistering) {
    return (
      <div className="flex flex-col h-[85vh] animate-fade-in">
        <header className="flex items-center mb-6">
          <button onClick={() => setIsRegistering(false)} className="mr-4 text-slate-400 hover:text-white">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-white">Join The Squad</h2>
        </header>

        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-slate-400 text-sm mb-2 font-medium">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Tom Curry"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 p-4 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-2 font-medium">Position Group</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setNewPos('Forward')}
                className={`p-4 rounded-xl border font-bold transition-all ${
                  newPos === 'Forward' 
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500/50'
                }`}
              >
                Forward
              </button>
              <button
                type="button"
                onClick={() => setNewPos('Back')}
                className={`p-4 rounded-xl border font-bold transition-all ${
                  newPos === 'Back' 
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500/50'
                }`}
              >
                Back
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold p-4 rounded-xl mt-8 shadow-lg shadow-emerald-900/20 active:scale-95 transition-transform"
          >
            Create Profile & Start
          </button>
        </form>
      </div>
    );
  }

  // VIEW 2: SELECT PLAYER
  if (!selectedPlayer) {
    return (
      <div className="flex flex-col h-[85vh] animate-fade-in">
        <header className="flex items-center mb-6">
          <button onClick={() => onNavigate('LANDING')} className="mr-4 text-slate-400">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-white">Who are you?</h2>
        </header>

        <input
          type="text"
          placeholder="Search your name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-white mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
        />

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 pb-20 custom-scrollbar">
          {filteredPlayers.map(player => (
            <button
              key={player.id}
              onClick={() => setSelectedPlayer(player)}
              className="w-full text-left p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center transition-colors group"
            >
              <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center mr-3 text-slate-400 group-hover:text-emerald-500 group-hover:bg-slate-600 transition-colors">
                <User size={20} />
              </div>
              <div>
                <div className="font-semibold text-white">{player.name}</div>
                <div className="text-xs text-slate-400">{player.position}</div>
              </div>
              <ChevronRight className="ml-auto text-slate-500 group-hover:text-emerald-500 transition-colors" size={20} />
            </button>
          ))}
          
          <div className="pt-4 pb-8 text-center">
             <button 
                onClick={() => setIsRegistering(true)}
                className="inline-flex items-center px-4 py-2 rounded-full bg-slate-800 text-emerald-500 font-medium hover:text-emerald-400 hover:bg-slate-700 border border-dashed border-emerald-500/30 hover:border-emerald-500 transition-all"
             >
                <Plus size={18} className="mr-2" /> 
                Not on the list? Join Team
             </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 3: WORKOUT SESSION
  if (activeDayId) {
    const day = PROGRAM.DAYS.find(d => d.id === activeDayId);
    if (!day) return null;
    return (
      <WorkoutSession
        player={selectedPlayer}
        day={day}
        existingLog={playerLogs.find(l => l.dayId === activeDayId)}
        onExit={() => setActiveDayId(null)}
      />
    );
  }

  // VIEW 4: ATHLETE DASHBOARD (Select Day)
  return (
    <div className="pb-20 animate-fade-in">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome, {selectedPlayer.name.split(' ')[0]}</h1>
          <p className="text-slate-400 text-sm">Ready to work?</p>
        </div>
        <button onClick={() => setSelectedPlayer(null)} className="text-xs text-emerald-500 font-medium hover:text-emerald-400">
          Switch User
        </button>
      </header>

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
                  ? 'bg-slate-900 border-emerald-900/50' 
                  : 'bg-slate-800 border-slate-700 hover:border-emerald-500/50'
                }
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                  {day.title}
                </span>
                {complete && <CheckCircle2 className="text-emerald-500" size={20} />}
              </div>
              
              <h3 className={`text-2xl font-bold mb-1 ${complete ? 'text-slate-500' : 'text-white'}`}>
                {day.focus}
              </h3>
              
              <div className="text-sm text-slate-400">
                {day.exercises.length} Exercises
              </div>
              
              {/* Decorative Number */}
              <div className="absolute bottom-2 right-4 text-6xl font-black text-slate-800 pointer-events-none opacity-50">
                {index + 1}
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <h4 className="text-white font-semibold mb-2 text-sm">Program Notes</h4>
        <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
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