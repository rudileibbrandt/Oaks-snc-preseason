import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { InjuryRecord } from '../types';
import { getPlayerInjuryHistory, formatInjuryDate, STATUS_COLORS, daysSinceInjury } from '../services/injuryData';

interface Props {
  playerName: string;
}

const InjuryHistorySection: React.FC<Props> = ({ playerName }) => {
  const [injuries, setInjuries] = useState<InjuryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const history = await getPlayerInjuryHistory(playerName);
        // Sort by createdAt descending (most recent first)
        history.sort((a, b) => (b.createdAt || b.updatedAt) - (a.createdAt || a.updatedAt));
        setInjuries(history);
      } catch (error) {
        console.error('[InjuryHistorySection] Failed to load history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [playerName]);

  if (isLoading) {
    return (
      <div className="mt-4 p-4 bg-neutral-800/50 rounded-lg">
        <div className="flex items-center gap-2 text-neutral-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading injury history...</span>
        </div>
      </div>
    );
  }

  if (injuries.length === 0) {
    return null; // Don't show section if no injury history
  }

  const activeInjuries = injuries.filter(i => i.currentStatus !== 'Returned to Play');
  const pastInjuries = injuries.filter(i => i.currentStatus === 'Returned to Play');

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-red-400" />
        <h3 className="text-sm font-bold text-white">Injury History</h3>
        <span className="text-xs text-neutral-500">({injuries.length} records)</span>
      </div>

      {/* Active Injuries */}
      {activeInjuries.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-red-400 mb-2 uppercase tracking-wide">Active</p>
          <div className="space-y-2">
            {activeInjuries.map(injury => (
              <InjuryHistoryCard
                key={injury.id}
                injury={injury}
                isExpanded={expandedId === injury.id}
                onToggle={() => setExpandedId(expandedId === injury.id ? null : injury.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Injuries */}
      {pastInjuries.length > 0 && (
        <div>
          <p className="text-xs text-green-400 mb-2 uppercase tracking-wide">Returned to Play</p>
          <div className="space-y-2">
            {pastInjuries.map(injury => (
              <InjuryHistoryCard
                key={injury.id}
                injury={injury}
                isExpanded={expandedId === injury.id}
                onToggle={() => setExpandedId(expandedId === injury.id ? null : injury.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface InjuryHistoryCardProps {
  injury: InjuryRecord;
  isExpanded: boolean;
  onToggle: () => void;
}

const InjuryHistoryCard: React.FC<InjuryHistoryCardProps> = ({ injury, isExpanded, onToggle }) => {
  const isReturned = injury.currentStatus === 'Returned to Play';
  const statusColor = STATUS_COLORS[injury.currentStatus];
  const days = daysSinceInjury(injury.dateOfInjury);

  return (
    <div className={`rounded-lg border overflow-hidden ${
      isReturned
        ? 'bg-green-500/5 border-green-500/20'
        : 'bg-red-500/10 border-red-500/20'
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-3 text-left"
      >
        {/* Status icon */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isReturned ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {isReturned ? (
            <CheckCircle size={16} className="text-green-400" />
          ) : (
            <AlertTriangle size={16} className="text-red-400" />
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">
              {(injury.bodyPart || []).join(', ') || 'N/A'}
            </p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor.bg} ${statusColor.text}`}>
              {injury.currentStatus === 'Day to Day' ? 'DTD' :
               injury.currentStatus === 'IR / Out' ? 'OUT' :
               injury.currentStatus === 'Returned to Play' ? 'RTP' : 'Q'}
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            {(injury.diagnosis || []).join(', ')} • {formatInjuryDate(injury.dateOfInjury)}
            {days !== null && ` (${days}d ago)`}
          </p>
        </div>

        {/* Expand icon */}
        {isExpanded ? (
          <ChevronUp size={16} className="text-neutral-500 flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-neutral-500 flex-shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-neutral-700/50">
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            <div>
              <span className="text-neutral-500">Type</span>
              <p className="text-white">{(injury.injuryType || []).join(', ') || 'N/A'}</p>
            </div>
            {injury.areaOnBody && (
              <div>
                <span className="text-neutral-500">Side</span>
                <p className="text-white">{injury.areaOnBody}</p>
              </div>
            )}
            {injury.returnToPlayDate && (
              <div>
                <span className="text-neutral-500">Return Date</span>
                <p className="text-green-400">{formatInjuryDate(injury.returnToPlayDate)}</p>
              </div>
            )}
            {injury.daysInjured && (
              <div>
                <span className="text-neutral-500">Days Out</span>
                <p className="text-white">{injury.daysInjured}</p>
              </div>
            )}
          </div>
          {injury.notes && (
            <div className="mt-2">
              <span className="text-xs text-neutral-500">Notes</span>
              <p className="text-xs text-neutral-300">{injury.notes}</p>
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-neutral-700/50">
            <p className="text-[10px] text-neutral-500">
              Reported by {injury.coachSubmitting}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InjuryHistorySection;
