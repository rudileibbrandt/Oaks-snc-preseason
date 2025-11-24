import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, WorkoutDay, WorkoutLog } from '../types';
import { PROGRAM } from '../services/programData';
import { db } from '../services/db';
import { ChevronLeft, Save, CheckCircle, Youtube } from 'lucide-react';
import { getISOWeekFromTimestamp, getISOWeekStart, getCurrentISOWeek, compareWeekIdentifiers, WeekIdentifier } from '../utils/weekUtils';

interface Props {
  player: Player;
  day: WorkoutDay;
  existingLog?: WorkoutLog;
  selectedWeek?: WeekIdentifier;
  onExit: () => void;
}

interface NumberInputProps {
  id: string;
  field: 'weight' | 'sets' | 'reps' | 'time';
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal';
  unit?: string;
  onChange: (id: string, field: 'weight' | 'sets' | 'reps' | 'time', value: string) => void;
  onBlur?: () => void;
}

const NumberInput: React.FC<NumberInputProps> = React.memo(({ 
  id, 
  field, 
  label, 
  value, 
  placeholder = '', 
  inputMode = 'numeric', 
  unit = '',
  onChange,
  onBlur
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(id, field, newValue);
  };

  return (
    <div className="flex-1">
      <label className="block text-xs text-neutral-400 mb-2 font-medium">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          maxLength={field === 'weight' ? 6 : 4}
          className="w-full bg-neutral-950 border-2 border-neutral-800 rounded-xl px-4 py-4 text-white text-lg font-semibold focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-center"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {unit && value && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
});

const WorkoutSession: React.FC<Props> = ({ player, day, existingLog, selectedWeek, onExit }) => {
  const [logData, setLogData] = useState<Record<string, string>>({});
  const logDataRef = useRef<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warmupOpen, setWarmupOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Check if selected week is in the future
  const currentWeek = getCurrentISOWeek();
  const isFutureWeek = selectedWeek ? compareWeekIdentifiers(selectedWeek, currentWeek) > 0 : false;

  useEffect(() => {
    if (existingLog) {
      setLogData(existingLog.data || {});
      logDataRef.current = existingLog.data || {};
      setCompleted(existingLog.completed);
      setWarmupOpen(false);
    }
  }, [existingLog]);

  // Keep ref in sync with state
  useEffect(() => {
    logDataRef.current = logData;
  }, [logData]);

  const handleInput = useCallback((id: string, field: 'weight' | 'sets' | 'reps' | 'time', value: string) => {
    // Allow any numeric input (including decimals for weight)
    // Remove any non-numeric characters except decimal point for weight
    let cleanedValue = value;
    if (field === 'weight') {
      // Allow numbers and one decimal point
      cleanedValue = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    } else {
      // For sets, reps, time - only allow whole numbers
      cleanedValue = value.replace(/[^\d]/g, '');
    }
    const key = `${id}_${field}`;
    // Use functional update to avoid losing focus
    setLogData(prev => {
      // Only update if value actually changed
      if (prev[key] === cleanedValue) {
        return prev;
      }
      return { ...prev, [key]: cleanedValue };
    });
  }, []);

  const handleSave = useCallback(async (markComplete: boolean) => {
    // Prevent saving to future weeks
    if (isFutureWeek) {
      setError('Cannot log workouts for future weeks');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    // Use selected week's timestamp, or current time if no week specified
    let timestamp = Date.now();
    let weekId: WeekIdentifier;
    
    if (selectedWeek) {
      weekId = selectedWeek;
      console.log('[WorkoutSession] Saving to selected week:', weekId.year, 'W' + weekId.week);
      // Use the start of the selected week + current time of day
      // This ensures logs are saved in the correct week but maintains time of day
      const weekStart = getISOWeekStart(selectedWeek.year, selectedWeek.week);
      const now = new Date();
      const timeOfDay = now.getHours() * 60 * 60 * 1000 + 
                        now.getMinutes() * 60 * 1000 + 
                        now.getSeconds() * 1000 + 
                        now.getMilliseconds();
      timestamp = weekStart.getTime() + timeOfDay;
      console.log('[WorkoutSession] Calculated timestamp:', new Date(timestamp).toISOString(), 'for week', weekId.year, 'W' + weekId.week);
    } else {
      // Calculate ISO week from current timestamp
      weekId = getISOWeekFromTimestamp(timestamp);
      console.log('[WorkoutSession] No selected week, using current week:', weekId.year, 'W' + weekId.week);
    }
    
    // Use ref to get latest logData without including it in dependencies
    const currentLogData = logDataRef.current;
    
    const newLog: WorkoutLog = {
      playerId: player.id,
      dayId: day.id,
      timestamp: timestamp,
      weekYear: weekId.year,
      week: weekId.week,
      data: currentLogData,
      completed: markComplete
    };
    
    console.log('[WorkoutSession] Saving log:', {
      playerId: newLog.playerId,
      dayId: newLog.dayId,
      weekYear: newLog.weekYear,
      week: newLog.week,
      completed: newLog.completed,
      dataKeys: Object.keys(newLog.data)
    });
    
    try {
      await db.saveLog(newLog);
      console.log('[WorkoutSession] Log saved successfully with weekYear:', newLog.weekYear, 'week:', newLog.week);
      setCompleted(markComplete);
      setIsSaving(false);
      
      // Don't exit immediately - let user see the saved state
      // The parent component will reload logs when we exit
      if (markComplete) {
        setTimeout(() => {
          console.log('[WorkoutSession] Exiting workout session');
          onExit();
        }, 1000);
      }
    } catch (err: any) {
      console.error('[WorkoutSession] Error saving workout:', err);
      setError(err.message || 'Failed to save workout');
      setIsSaving(false);
    }
  }, [isFutureWeek, selectedWeek, player.id, day.id, onExit]);

  const handleInputBlur = useCallback(() => {
    handleSave(false);
  }, [handleSave]);

  return (
    <div className="flex flex-col h-full animate-fade-in pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-neutral-950 z-20 pb-4 border-b border-neutral-900 mb-6">
        <div className="flex items-center justify-between">
          <button onClick={onExit} className="p-2 -ml-2 text-neutral-400 hover:text-white">
            <ChevronLeft />
          </button>
          <div className="text-center">
            {isFutureWeek && (
              <div className="text-xs text-amber-500 mb-1">⚠️ Future week - cannot log</div>
            )}
            <h2 className="font-bold text-white text-lg">{day.title}</h2>
            <p className="text-xs text-amber-500 font-medium">{day.focus}</p>
          </div>
          <div className="w-8" />
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Warmup Section */}
        <div className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800">
          <button 
            onClick={() => setWarmupOpen(!warmupOpen)}
            className="w-full p-4 bg-neutral-950/50 flex justify-between items-center text-left hover:bg-neutral-950 transition-colors"
          >
            <div>
              <h3 className="text-amber-500 font-bold text-base mb-1">Warm Up</h3>
              <p className="text-xs text-neutral-400">Mandatory Daily Protocol</p>
            </div>
            <span className="text-neutral-500 text-sm font-medium">{warmupOpen ? 'Hide' : 'Show'}</span>
          </button>
          
          {warmupOpen && (
            <div className="p-4 space-y-3">
              {PROGRAM.WARMUP.map(ex => (
                <div key={ex.id} className="flex items-center justify-between py-2 border-b border-neutral-800/50 last:border-0">
                  <div>
                    <div className="text-white font-medium">{ex.name}</div>
                    <div className="text-neutral-500 text-xs mt-0.5">{ex.reps}</div>
                  </div>
                  {ex.videoUrl && (
                    <a 
                      href={ex.videoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-4 p-2 bg-neutral-800 text-amber-500 rounded-lg hover:bg-neutral-700 transition-colors"
                    >
                      <Youtube size={18} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Workout */}
        <div className="space-y-6">
          {day.exercises.map(ex => (
            <div key={ex.id} className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
              {/* Exercise Header */}
              <div className="p-4 bg-neutral-950/50 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-white mb-1">{ex.name}</h4>
                  <p className="text-sm text-neutral-400">{ex.reps}</p>
                </div>
                {ex.videoUrl && (
                  <a 
                    href={ex.videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-4 p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-amber-500 transition-colors"
                  >
                    <Youtube size={20} />
                  </a>
                )}
              </div>

              {/* Input Fields */}
              {ex.isMetric ? (
                ex.isSprint ? (
                  <div className="p-4 space-y-4">
                    <NumberInput
                      id={ex.id}
                      field="sets"
                      label="Sets"
                      value={logData[`${ex.id}_sets`] || ''}
                      placeholder="8"
                      inputMode="numeric"
                      onChange={handleInput}
                      onBlur={handleInputBlur}
                    />
                    <NumberInput
                      id={ex.id}
                      field="time"
                      label="Time"
                      value={logData[`${ex.id}_time`] || ''}
                      placeholder="4.5"
                      inputMode="decimal"
                      unit="sec"
                      onChange={handleInput}
                      onBlur={handleInputBlur}
                    />
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    <NumberInput
                      id={ex.id}
                      field="weight"
                      label="Weight"
                      value={logData[`${ex.id}_weight`] || ''}
                      placeholder="225"
                      inputMode="decimal"
                      unit="lbs"
                      onChange={handleInput}
                      onBlur={handleInputBlur}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <NumberInput
                        id={ex.id}
                        field="sets"
                        label="Sets"
                        value={logData[`${ex.id}_sets`] || ''}
                        placeholder="4"
                        inputMode="numeric"
                        onChange={handleInput}
                        onBlur={() => handleSave(false)}
                      />
                      <NumberInput
                        id={ex.id}
                        field="reps"
                        label="Reps"
                        value={logData[`${ex.id}_reps`] || ''}
                        placeholder="5"
                        inputMode="numeric"
                        onChange={handleInput}
                        onBlur={() => handleSave(false)}
                      />
                    </div>
                  </div>
                )
              ) : (
                <div className="p-4">
                  <div className="text-sm text-green-500 flex items-center justify-center py-2">
                    <CheckCircle size={16} className="mr-2" /> No entry required
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 bg-red-900/20 border border-red-900/50 p-3 rounded-xl text-red-500 text-sm">
            {error}
          </div>
        )}
        
        <button
          onClick={() => handleSave(true)}
          disabled={isSaving || isFutureWeek}
          className={`
            w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center transition-all
            ${completed 
              ? 'bg-neutral-800 text-green-400 cursor-default' 
              : isFutureWeek
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-black active:scale-95'
            } disabled:opacity-50 disabled:cursor-not-allowed
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