import React, { useMemo, useState } from 'react';
import { Player, WorkoutLog } from '../types';
import { alumniRecords, isAlumni } from '../services/alumni';
import { GraduationCap } from 'lucide-react';

interface Props {
  players: Player[];
  allLogs: WorkoutLog[];
  currentPlayer?: Player | null;
}

const shortClass = (year?: number) => (year ? `'${String(year).slice(-2)}` : '');

const AlumniBoard: React.FC<Props> = ({ players, allLogs, currentPlayer }) => {
  const alumni = useMemo(() => players.filter(p => p.role === 'Player' && isAlumni(p)), [players]);
  const classes = useMemo(
    () => Array.from(new Set(alumni.map(p => p.alumniClass!))).sort((a, b) => b - a),
    [alumni],
  );
  const [classFilter, setClassFilter] = useState<number | 'all'>('all');

  const shown = classFilter === 'all' ? alumni : alumni.filter(p => p.alumniClass === classFilter);
  const records = useMemo(() => alumniRecords(shown, allLogs), [shown, allLogs]);

  if (alumni.length === 0) {
    return (
      <div className="p-8 rounded-xl border bg-neutral-900 border-neutral-800 text-center text-neutral-500 text-sm mb-8">
        <GraduationCap className="mx-auto mb-3 text-neutral-600" size={32} />
        No alumni yet. Coaches can move graduated players to Alumni from the Admin Panel.
      </div>
    );
  }

  const sections: Array<'Intermediate' | 'Advanced'> = ['Intermediate', 'Advanced'];

  return (
    <div className="space-y-6 mb-8">
      {/* Class filter */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...classes] as Array<number | 'all'>).map(c => (
          <button
            key={c}
            onClick={() => setClassFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              classFilter === c
                ? 'bg-amber-500 text-black border-amber-500'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
            }`}
          >
            {c === 'all' ? `All alumni (${alumni.length})` : `Class of ${c}`}
          </button>
        ))}
      </div>

      {records.length === 0 && (
        <div className="p-6 rounded-xl border bg-neutral-900 border-neutral-800 text-center text-neutral-500 text-sm">
          No logged lifts or tests for these alumni.
        </div>
      )}

      {sections.map(program => {
        const list = records.filter(r => r.program === program);
        if (list.length === 0) return null;
        return (
          <div key={program}>
            <h3 className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-3">{program} records</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {list.map(record => (
                <div key={record.key} className="p-4 rounded-xl border bg-neutral-900 border-neutral-800">
                  <h4 className="font-bold text-neutral-300 text-sm mb-3">{record.label}</h4>
                  <div className="space-y-2">
                    {record.entries.slice(0, 10).map((entry, index) => {
                      const rank = index + 1;
                      const isMe = entry.player.id === currentPlayer?.id;
                      return (
                        <div
                          key={entry.player.id}
                          className={`p-2 rounded-lg border flex items-center justify-between ${
                            isMe ? 'bg-amber-500/20 border-amber-500/50' : 'bg-black/40 border-neutral-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                              rank === 1 ? 'bg-amber-500 text-black' :
                              rank === 2 ? 'bg-neutral-400 text-black' :
                              rank === 3 ? 'bg-amber-800 text-white' :
                              'bg-neutral-800 text-neutral-400'
                            }`}>
                              {rank}
                            </div>
                            <span className={`text-sm truncate ${isMe ? 'font-bold text-white' : 'text-neutral-300'}`}>
                              {entry.player.name}
                            </span>
                            <span className="text-xs text-neutral-500 flex-shrink-0">{shortClass(entry.player.alumniClass)}</span>
                          </div>
                          <span className={`font-mono font-bold text-sm flex-shrink-0 ${isMe ? 'text-amber-500' : 'text-neutral-400'}`}>
                            {entry.display}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AlumniBoard;
