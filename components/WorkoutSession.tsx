import React, { useState, useEffect } from 'react';
import { Player, WorkoutDay, WorkoutLog } from '../types';
import { PROGRAM } from '../services/programData';
import { db } from '../services/db';
import { ChevronLeft, Save, CheckCircle, Youtube } from 'lucide-react';

interface Props {
  player: Player;
  day: WorkoutDay;
  existingLog?: WorkoutLog;
  onExit: () => void;
}

const WorkoutSession: React.FC<Props> = ({ player, day, existingLog, onExit }) => {
  const [logData, setLogData] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warmupOpen, setWarmupOpen] = useState(true);

  useEffect(() => {
    if (existingLog) {
      setLogData(existingLog.data || {});
      setCompleted(existingLog.completed);
      setWarmupOpen(false);
    }
  }, [existingLog]);

  const handleInput = (id: string, field: 'weight' | 'sets' | 'reps', value: string) => {
    const key = `${id}_${field}`;
    setLogData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (markComplete: boolean) => {
    setIsSaving(true);
    const newLog: WorkoutLog = {
      playerId: player.id,
      dayId: day.id,
      timestamp: Date.now(),
      data: logData,
      completed: markComplete
    };
    
    await db.saveLog(newLog);
    setCompleted(markComplete);
    setIsSaving(false);
    
    if (markComplete) {
      setTimeout(onExit, 500);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-neutral-950 z-20 pb-4 border-b border-neutral-900 mb-6">
        <div className="flex items-center justify-between">
          <button onClick={onExit} className="p-2 -ml-2 text-neutral-400 hover:text-white">
            <ChevronLeft />
          </button>
          <div className="text-center">
            <h2 className="font-bold text-white text-lg">{day.title}</h2>
            <p className="text-xs text-amber-500 font-medium">{day.focus}</p>
          </div>
          <div className="w-8" />
        </div>
      </div>

      <div className="space-y-8">
        
        {/* Warmup Section */}
        <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800">
          <button 
            onClick={() => setWarmupOpen(!warmupOpen)}
            className="w-full p-4 bg-neutral-900 flex justify-between items-center text-left"
          >
            <div>
              <h3 className="text-amber-500 font-bold uppercase tracking-wider text-sm">Warm Up</h3>
              <p className="text-xs text-neutral-400">Mandatory Daily Protocol</p>
            </div>
            <span className="text-neutral-500 text-xs">{warmupOpen ? 'Hide' : 'Show'}</span>
          </button>
          
          {warmupOpen && (
            <div className="p-4 pt-0 space-y-4 border-t border-neutral-800/50 mt-2">
              {PROGRAM.WARMUP.map(ex => (
                <div key={ex.id} className="flex items-start justify-between py-2 border-b border-neutral-800/50 last:border-0">
                  <div>
                    <div className="text-white font-medium">{ex.name}</div>
                    <div className="text-neutral-500 text-xs">{ex.reps}</div>
                  </div>
                  {ex.videoUrl && (
                    <a 
                      href={ex.videoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-neutral-800 text-amber-500 rounded-lg hover:bg-neutral-700 transition-colors"
                    >
                      <Youtube size={20} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Workout */}
        <div>
          <h3 className="text-white font-bold mb-4 px-2">Main Session</h3>
          <div className="space-y-4">
            {day.exercises.map(ex => (
              <div key={ex.id} className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-white">{ex.name}</h4>
                    <span className="inline-block px-2 py-0.5 bg-neutral-800 rounded text-xs text-neutral-300 font-mono">
                      {ex.reps}
                    </span>
                  </div>
                  {ex.videoUrl && (
                    <a 
                      href={ex.videoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-amber-500 hover:text-amber-400 p-1"
                    >
                      <Youtube size={24} />
                    </a>
                  )}
                </div>

                {ex.isMetric ? (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-neutral-500 mb-1 uppercase font-bold tracking-wider">Weight (kg)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="-"
                        value={logData[`${ex.id}_weight`] || ''}
                        onChange={e => handleInput(ex.id, 'weight', e.target.value)}
                        onBlur={() => handleSave(false)}
                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-amber-500 outline-none transition-colors text-center font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500 mb-1 uppercase font-bold tracking-wider">Sets</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="-"
                        value={logData[`${ex.id}_sets`] || ''}
                        onChange={e => handleInput(ex.id, 'sets', e.target.value)}
                        onBlur={() => handleSave(false)}
                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-amber-500 outline-none transition-colors text-center font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500 mb-1 uppercase font-bold tracking-wider">Reps</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="-"
                        value={logData[`${ex.id}_reps`] || ''}
                        onChange={e => handleInput(ex.id, 'reps', e.target.value)}
                        onBlur={() => handleSave(false)}
                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-amber-500 outline-none transition-colors text-center font-mono"
                      />
                    </div>
                  </div>
                ) : (
                   <div className="mt-2 text-xs text-green-500 flex items-center">
                     <CheckCircle size={14} className="mr-1" /> No entry required
                   </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => handleSave(true)}
          disabled={isSaving}
          className={`
            w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center transition-all
            ${completed 
              ? 'bg-neutral-800 text-green-400 cursor-default' 
              : 'bg-amber-500 hover:bg-amber-400 text-black active:scale-95'
            }
          `}
        >
          {isSaving ? (
            'Saving...'
          ) : completed ? (
            <>
              <CheckCircle className="mr-2" /> Session Complete
            </>
          ) : (
            <>
              <Save className="mr-2" size={20} /> Finish Workout
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default WorkoutSession;