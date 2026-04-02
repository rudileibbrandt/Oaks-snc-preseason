import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Search, X, ChevronDown, ChevronUp, Calendar, Clock, Loader2 } from 'lucide-react';
import { AppView, Player, InjuryRecord } from '../types';
import { STATUS_COLORS, formatInjuryDate, daysSinceInjury, loadInjuries, migrateHardcodedInjuries } from '../services/injuryData';
import { getPhotoUrl } from '../services/rosterData';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

type StatusFilter = 'All' | 'Day to Day' | 'Questionable' | 'IR / Out' | 'Returned to Play';
type TeamFilter = 'All' | 'Varsity' | 'Academy';

const InjuryTracker: React.FC<Props> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [injuries, setInjuries] = useState<InjuryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load injuries from database
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await migrateHardcodedInjuries();
        const data = await loadInjuries();
        setInjuries(data);
        console.log('[InjuryTracker] Loaded injuries:', data.length);
      } catch (error) {
        console.error('[InjuryTracker] Error loading injuries:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Filter injuries
  const filteredInjuries = useMemo(() => {
    return injuries.filter(injury => {
      const matchesSearch = searchQuery === '' ||
        injury.playerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (injury.bodyPart || []).some(p => p.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (injury.diagnosis || []).some(d => d.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'All' || injury.currentStatus === statusFilter;
      const matchesTeam = teamFilter === 'All' || injury.team === teamFilter;

      return matchesSearch && matchesStatus && matchesTeam;
    });
  }, [searchQuery, statusFilter, teamFilter, injuries]);

  // Count by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'Day to Day': 0,
      'Questionable': 0,
      'IR / Out': 0,
      'Returned to Play': 0,
    };
    injuries.forEach(r => {
      counts[r.currentStatus]++;
    });
    return counts;
  }, [injuries]);

  const activeCount = useMemo(() => {
    return injuries.filter(i => i.currentStatus !== 'Returned to Play').length;
  }, [injuries]);

  const handleImageError = (playerName: string) => {
    setImageErrors(prev => new Set(prev).add(playerName));
  };

  const renderInjuryCard = (injury: InjuryRecord) => {
    const isExpanded = expandedId === injury.id;
    const statusColor = STATUS_COLORS[injury.currentStatus];
    const photoUrl = getPhotoUrl(injury.playerName);
    const hasImageError = imageErrors.has(injury.playerName);
    const days = daysSinceInjury(injury.dateOfInjury);

    return (
      <div
        key={injury.id}
        className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden"
      >
        {/* Header - always visible */}
        <button
          onClick={() => setExpandedId(isExpanded ? null : injury.id)}
          className="w-full p-3 flex items-center gap-3 text-left"
        >
          {/* Photo */}
          <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0 relative">
            {!hasImageError && photoUrl ? (
              <img
                src={photoUrl}
                alt={injury.playerName}
                className="w-full h-full object-cover"
                onError={() => handleImageError(injury.playerName)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600">
                <AlertTriangle size={20} />
              </div>
            )}
            {/* Injury overlay */}
            <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
              <span className="text-[8px] font-bold text-white bg-red-500 px-1 rounded">INJ</span>
            </div>
          </div>

          {/* Name and Status */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate">{injury.playerName}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
                {injury.currentStatus}
              </span>
              <span className="text-xs text-neutral-500">{injury.team}</span>
            </div>
          </div>

          {/* Injury summary */}
          <div className="text-right flex-shrink-0">
            <p className="text-sm text-neutral-300">{(injury.bodyPart || []).join(', ') || 'N/A'}</p>
            <p className="text-xs text-neutral-500">
              {days !== null ? `${days}d ago` : formatInjuryDate(injury.dateOfInjury)}
            </p>
          </div>

          {/* Expand icon */}
          {isExpanded ? (
            <ChevronUp size={20} className="text-neutral-500" />
          ) : (
            <ChevronDown size={20} className="text-neutral-500" />
          )}
        </button>

        {/* Expanded details */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-0 border-t border-neutral-800">
            <div className="grid grid-cols-2 gap-3 mt-3">
              {/* Date of Injury */}
              <div>
                <label className="text-xs text-neutral-500">Date of Injury</label>
                <p className="text-sm text-white flex items-center gap-1">
                  <Calendar size={12} />
                  {formatInjuryDate(injury.dateOfInjury)}
                </p>
              </div>

              {/* Days Injured */}
              <div>
                <label className="text-xs text-neutral-500">Days Injured</label>
                <p className="text-sm text-white flex items-center gap-1">
                  <Clock size={12} />
                  {injury.daysInjured ?? (days !== null ? days : 'TBD')}
                </p>
              </div>

              {/* Injury Type */}
              <div>
                <label className="text-xs text-neutral-500">Type</label>
                <p className="text-sm text-white">{(injury.injuryType || []).join(', ') || 'N/A'}</p>
              </div>

              {/* Area */}
              <div>
                <label className="text-xs text-neutral-500">Area</label>
                <p className="text-sm text-white">{injury.areaOnBody || 'N/A'}</p>
              </div>

              {/* Body Part */}
              <div>
                <label className="text-xs text-neutral-500">Body Part</label>
                <p className="text-sm text-white">{(injury.bodyPart || []).join(', ') || 'N/A'}</p>
              </div>

              {/* Diagnosis */}
              <div>
                <label className="text-xs text-neutral-500">Diagnosis</label>
                <p className="text-sm text-white">{(injury.diagnosis || []).join(', ') || 'N/A'}</p>
              </div>

              {/* Position */}
              {injury.positions && (
                <div>
                  <label className="text-xs text-neutral-500">Position</label>
                  <p className="text-sm text-white">{injury.positions}</p>
                </div>
              )}

              {/* Class */}
              {injury.classYear && (
                <div>
                  <label className="text-xs text-neutral-500">Class</label>
                  <p className="text-sm text-white">{injury.classYear} (Grade {injury.grade})</p>
                </div>
              )}

              {/* Return to Play Date */}
              {injury.returnToPlayDate && (
                <div className="col-span-2">
                  <label className="text-xs text-neutral-500">Return to Play Date</label>
                  <p className="text-sm text-green-400">{formatInjuryDate(injury.returnToPlayDate)}</p>
                </div>
              )}

              {/* Notes */}
              {injury.notes && (
                <div className="col-span-2">
                  <label className="text-xs text-neutral-500">Notes</label>
                  <p className="text-sm text-neutral-300">{injury.notes}</p>
                </div>
              )}
            </div>

            {/* Submitted by */}
            <div className="mt-3 pt-3 border-t border-neutral-800">
              <p className="text-xs text-neutral-500">
                Submitted by {injury.coachSubmitting}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-neutral-950 z-10 pb-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => onNavigate('LANDING')}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={24} />
              Injury Tracker
            </h1>
            <p className="text-xs text-neutral-500">
              {activeCount} active injuries • {injuries.length} total records
            </p>
          </div>
        </div>

        {/* Status summary */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {Object.entries(statusCounts).map(([status, count]) => {
            if (count === 0) return null;
            const color = STATUS_COLORS[status];
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? 'All' : status as StatusFilter)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? `${color.bg} ${color.text} border ${color.border}`
                    : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                }`}
              >
                {status}
                <span className="bg-neutral-800 px-1.5 py-0.5 rounded">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by name, body part, diagnosis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Team filter */}
        <div className="flex gap-2">
          {(['All', 'Varsity', 'Academy'] as TeamFilter[]).map(team => (
            <button
              key={team}
              onClick={() => setTeamFilter(team)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                teamFilter === team
                  ? 'bg-red-500 text-white'
                  : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
              }`}
            >
              {team}
            </button>
          ))}
        </div>
      </div>

      {/* Injury List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-neutral-500">
            <Loader2 size={32} className="animate-spin mr-3" />
            <span>Loading injuries...</span>
          </div>
        ) : filteredInjuries.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <AlertTriangle size={48} className="mx-auto mb-4 opacity-50" />
            <p>No injuries found</p>
          </div>
        ) : (
          filteredInjuries.map(renderInjuryCard)
        )}
      </div>
    </div>
  );
};

export default InjuryTracker;
