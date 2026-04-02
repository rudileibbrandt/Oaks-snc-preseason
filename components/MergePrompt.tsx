import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, X, Loader2, Check } from 'lucide-react';
import { Player } from '../types';
import { mergeAccounts, MergeResult } from '../services/db';
import { loadRatings } from '../services/ratingData';

interface Props {
  currentPlayer: Player;
  duplicates: Player[];
  onMergeComplete: () => void;
  onDismiss: () => void;
}

function getDismissalKey(id1: string, id2: string): string {
  const sorted = [id1, id2].sort();
  return `oaks_merge_dismissed_${sorted[0]}_${sorted[1]}`;
}

export function isDismissed(currentId: string, duplicates: Player[]): boolean {
  return duplicates.every(d => {
    const key = getDismissalKey(currentId, d.id);
    return localStorage.getItem(key) === 'true';
  });
}

const MergePrompt: React.FC<Props> = ({ currentPlayer, duplicates, onMergeComplete, onDismiss }) => {
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratingCounts, setRatingCounts] = useState<Map<string, number>>(new Map());
  const [selectedKeepId, setSelectedKeepId] = useState<string | null>(
    // Auto-select if there's only one other account
    duplicates.length === 1 ? duplicates[0].id : null
  );

  useEffect(() => {
    loadRatings().then(ratings => {
      const counts = new Map<string, number>();
      counts.set(currentPlayer.id, ratings.filter(r => r.raterId === currentPlayer.id).length);
      for (const dup of duplicates) {
        counts.set(dup.id, ratings.filter(r => r.raterId === dup.id).length);
      }
      setRatingCounts(counts);
    });
  }, [currentPlayer.id, duplicates]);

  const handleMerge = async () => {
    if (!selectedKeepId) return;
    const keepAccount = duplicates.find(a => a.id === selectedKeepId)!;
    setIsMerging(true);
    setError(null);
    try {
      const result = await mergeAccounts(keepAccount, currentPlayer);
      setMergeResult(result);
      setTimeout(() => {
        onMergeComplete();
      }, 2000);
    } catch (e: any) {
      console.error('[MergePrompt] Merge failed:', e);
      setError(e.message || 'Merge failed. Please try again.');
      setIsMerging(false);
    }
  };

  const handleDismiss = () => {
    for (const dup of duplicates) {
      const key = getDismissalKey(currentPlayer.id, dup.id);
      localStorage.setItem(key, 'true');
    }
    onDismiss();
  };

  const currentRatingCount = ratingCounts.get(currentPlayer.id) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-white font-bold">Duplicate Account Found</h2>
            <p className="text-yellow-300/80 text-sm mt-1">
              Your current login will be merged into the account you select below.
            </p>
          </div>
          {!isMerging && !mergeResult && (
            <button onClick={handleDismiss} className="text-neutral-500 hover:text-neutral-300">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {mergeResult ? (
            <div className="text-center py-4">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Merge Complete</h3>
              <div className="text-neutral-400 text-sm space-y-1">
                {mergeResult.ratingsReattributed > 0 && (
                  <p>{mergeResult.ratingsReattributed} rating{mergeResult.ratingsReattributed !== 1 ? 's' : ''} transferred</p>
                )}
                {mergeResult.ratingsDeduplicated > 0 && (
                  <p>{mergeResult.ratingsDeduplicated} duplicate{mergeResult.ratingsDeduplicated !== 1 ? 's' : ''} consolidated</p>
                )}
                {mergeResult.historyReattributed > 0 && (
                  <p>{mergeResult.historyReattributed} history entr{mergeResult.historyReattributed !== 1 ? 'ies' : 'y'} updated</p>
                )}
                {mergeResult.injuriesUpdated > 0 && (
                  <p>{mergeResult.injuriesUpdated} injur{mergeResult.injuriesUpdated !== 1 ? 'ies' : 'y'} record updated</p>
                )}
                {mergeResult.ratingsReattributed === 0 && mergeResult.ratingsDeduplicated === 0 &&
                  mergeResult.historyReattributed === 0 && mergeResult.injuriesUpdated === 0 && (
                  <p>No data needed to be transferred</p>
                )}
              </div>
              <p className="text-neutral-500 text-xs mt-3">Redirecting...</p>
            </div>
          ) : (
            <>
              {/* Current account — always the one being merged away */}
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-3">
                <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1">This login (will be merged away)</div>
                <div className="text-white font-semibold text-sm">{currentPlayer.name}</div>
                <div className="text-neutral-400 text-xs">{currentPlayer.email || 'No email'}</div>
                <div className="text-neutral-500 text-xs mt-1">{currentRatingCount} rating{currentRatingCount !== 1 ? 's' : ''}</div>
              </div>

              <div className="flex items-center justify-center text-neutral-500 text-xs py-1">
                merge into
              </div>

              {/* Other accounts — selectable */}
              <p className="text-neutral-400 text-xs">Select which account to keep:</p>
              {duplicates.map(acct => {
                const count = ratingCounts.get(acct.id) || 0;
                const isSelected = selectedKeepId === acct.id;
                return (
                  <button
                    key={acct.id}
                    onClick={() => setSelectedKeepId(acct.id)}
                    disabled={isMerging}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                        : 'bg-neutral-800/50 border-neutral-700/50 hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-white font-semibold text-sm">{acct.name}</div>
                        <div className="text-neutral-400 text-xs mt-0.5">{acct.email || 'No email'}</div>
                        <div className="text-neutral-500 text-xs mt-1">{count} rating{count !== 1 ? 's' : ''}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500'
                          : 'border-neutral-600'
                      }`}>
                        {isSelected && <Check size={12} className="text-black" />}
                      </div>
                    </div>
                  </button>
                );
              })}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleDismiss}
                  disabled={isMerging}
                  className="flex-1 py-3 px-4 rounded-lg text-sm font-semibold text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-colors disabled:opacity-50"
                >
                  Keep Separate
                </button>
                <button
                  onClick={handleMerge}
                  disabled={isMerging || !selectedKeepId}
                  className="flex-1 py-3 px-4 rounded-lg text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:bg-neutral-700 disabled:text-neutral-500 flex items-center justify-center gap-2"
                >
                  {isMerging ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Merging...
                    </>
                  ) : (
                    'Merge'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MergePrompt;
