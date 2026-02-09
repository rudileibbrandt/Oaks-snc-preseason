import React, { useState, useEffect, useCallback } from 'react';
import { X, Star, Loader2, Users, Trash2 } from 'lucide-react';
import { Player, RosterPlayer, PlayerRatings, PlayerRating } from '../types';
import { RATING_SKILLS, RATING_LABELS, RATING_COLORS, createEmptyRatings, areRatingsComplete, saveRating, getMyRatingForPlayer, deleteRating } from '../services/ratingData';
import { getPhotoUrl } from '../services/rosterData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  player: RosterPlayer;
  currentPlayer: Player;
}

const RatingModal: React.FC<Props> = ({ isOpen, onClose, onSave, player, currentPlayer }) => {
  const [ratings, setRatings] = useState<PlayerRatings>(createEmptyRatings());
  const [existingRating, setExistingRating] = useState<PlayerRating | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Load existing rating when modal opens
  useEffect(() => {
    if (isOpen && currentPlayer?.id) {
      const loadExisting = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const existing = await getMyRatingForPlayer(currentPlayer.id, player.name);
          if (existing) {
            setExistingRating(existing);
            setRatings(existing.ratings);
            console.log('[RatingModal] Loaded existing rating:', existing.id);
          } else {
            setExistingRating(null);
            setRatings(createEmptyRatings());
            console.log('[RatingModal] No existing rating found');
          }
        } catch (err) {
          console.error('[RatingModal] Error loading rating:', err);
          setError('Failed to load existing rating');
        } finally {
          setIsLoading(false);
        }
      };
      loadExisting();
    }
  }, [isOpen, player.name, currentPlayer?.id]);

  const handleRatingChange = useCallback((skill: keyof PlayerRatings, value: number) => {
    setRatings(prev => ({ ...prev, [skill]: value }));
  }, []);

  const handleSave = async () => {
    if (!areRatingsComplete(ratings)) {
      setError('Please rate all skills before saving');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveRating({
        playerName: player.name,
        raterId: currentPlayer.id,
        raterName: currentPlayer.name,
        ratings,
      });
      console.log('[RatingModal] Rating saved successfully');
      onSave();
      onClose();
    } catch (err) {
      console.error('[RatingModal] Error saving rating:', err);
      setError('Failed to save rating. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRating) return;

    setIsDeleting(true);
    setError(null);

    try {
      const success = await deleteRating(existingRating.id);
      if (success) {
        console.log('[RatingModal] Rating deleted successfully');
        onSave();
        onClose();
      } else {
        setError('Rating not found');
      }
    } catch (err) {
      console.error('[RatingModal] Error deleting rating:', err);
      setError('Failed to delete rating. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen) return null;

  const photoUrl = getPhotoUrl(player.name);
  const isComplete = areRatingsComplete(ratings);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Rate Player</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            disabled={isSaving}
          >
            <X size={20} className="text-neutral-400" />
          </button>
        </div>

        {/* Player Info */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
              {!imageError && photoUrl ? (
                <img
                  src={photoUrl}
                  alt={player.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Users size={24} className="text-neutral-600" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{player.name}</h3>
              <p className="text-sm text-neutral-400">{player.squad} • {player.trainingGroup} Group</p>
              {existingRating && (
                <p className="text-xs text-amber-400 mt-1">
                  Last rated: {new Date(existingRating.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Rating Form */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {RATING_SKILLS.map(skill => (
                <div key={skill.key} className="bg-neutral-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">{skill.label}</p>
                      <p className="text-xs text-neutral-500">{skill.description}</p>
                    </div>
                    {(ratings[skill.key] ?? 0) > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded ${RATING_COLORS[ratings[skill.key] || 1].bg} ${RATING_COLORS[ratings[skill.key] || 1].text}`}>
                        {RATING_LABELS[ratings[skill.key] || 1]}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(value => {
                      const isSelected = (ratings[skill.key] ?? 0) === value;
                      const colors = RATING_COLORS[value];
                      return (
                        <button
                          key={value}
                          onClick={() => handleRatingChange(skill.key, value)}
                          className={`flex-1 py-2 px-1 rounded-lg border text-sm font-medium transition-all ${
                            isSelected
                              ? `${colors.bg} ${colors.text} ${colors.border}`
                              : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <Star size={12} className={isSelected ? 'fill-current' : ''} />
                            <span>{value}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rating Scale Legend */}
          <div className="mt-4 p-3 bg-neutral-800/30 rounded-lg">
            <p className="text-xs text-neutral-500 mb-2">Rating Scale</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {[1, 2, 3, 4, 5].map(value => (
                <div key={value} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${RATING_COLORS[value].bg.replace('/20', '')}`}></span>
                  <span className="text-neutral-400">{value} = {RATING_LABELS[value]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && existingRating && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400 mb-3">
                Are you sure you want to delete your rating for {player.name}?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 px-3 bg-neutral-800 text-neutral-300 rounded-lg text-sm hover:bg-neutral-700 transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-3 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Rating'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            {existingRating && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="py-3 px-4 bg-neutral-800 text-red-400 rounded-lg font-medium hover:bg-red-500/20 transition-colors"
                disabled={isSaving || isDeleting}
                title="Delete rating"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-neutral-800 text-neutral-300 rounded-lg font-medium hover:bg-neutral-700 transition-colors"
              disabled={isSaving || isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isComplete || isSaving || isDeleting}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                isComplete && !isSaving && !isDeleting
                  ? 'bg-amber-500 text-black hover:bg-amber-400'
                  : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Rating'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;
