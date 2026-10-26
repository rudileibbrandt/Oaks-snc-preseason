import React, { useState } from 'react';
import { CheckCircle, Search, X } from 'lucide-react';
import { getPhotoUrl } from '../services/rosterData';

export interface ChecklistRow {
  name: string;
  sublabel: string;
  badge?: string; // e.g. "Senior" or "'28"
  disabled?: boolean;
  action?: { label: string; onClick: () => void; busy?: boolean }; // e.g. Restore on an alumni row
}

interface Props {
  title: React.ReactNode;
  intro: string;
  rows: ChecklistRow[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onClose: () => void;
  footer: React.ReactNode;
}

// A bottom-sheet list of roster players with photos and tick boxes, plus a search box.
// Used by Mark Seniors and Graduate Seniors.
const RosterChecklist: React.FC<Props> = ({ title, intro, rows, selected, onToggle, onClose, footer }) => {
  const [query, setQuery] = useState('');
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());
  const shown = query.trim() ? rows.filter(r => r.name.toLowerCase().includes(query.toLowerCase())) : rows;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-neutral-950 border border-neutral-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">{title}</h2>
            <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white"><X size={20} /></button>
          </div>
          <p className="text-xs text-neutral-400 mb-3">{intro}</p>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search players..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {shown.map(row => {
            const checked = !row.disabled && selected.has(row.name);
            const photo = getPhotoUrl(row.name);
            return (
              <div
                key={row.name}
                className={`flex items-center gap-2 pr-2 rounded-lg transition-colors ${
                  checked ? 'bg-purple-500/15' : 'hover:bg-neutral-900'
                }`}
              >
              <button
                type="button"
                disabled={row.disabled}
                onClick={() => onToggle(row.name)}
                className={`flex-1 min-w-0 flex items-center gap-3 p-2 text-left ${
                  row.disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className={`w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center ${
                  checked ? 'bg-purple-500 border-purple-500' : 'border-neutral-600'
                }`}>
                  {checked && <CheckCircle size={14} className="text-white" />}
                </div>
                {photo && !brokenPhotos.has(row.name) ? (
                  <img
                    src={photo}
                    alt=""
                    onError={() => setBrokenPhotos(prev => new Set(prev).add(row.name))}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-neutral-800"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full flex-shrink-0 bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">
                    {row.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{row.name}</div>
                  <div className="text-[11px] text-neutral-500">{row.sublabel}</div>
                </div>
              </button>
                {row.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex-shrink-0">{row.badge}</span>
                )}
                {row.action && (
                  <button
                    type="button"
                    onClick={row.action.onClick}
                    disabled={row.action.busy}
                    className="text-xs px-2 py-1 rounded-md bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {row.action.busy ? 'Saving...' : row.action.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-neutral-800 space-y-3">{footer}</div>
      </div>
    </div>
  );
};

export default RosterChecklist;
