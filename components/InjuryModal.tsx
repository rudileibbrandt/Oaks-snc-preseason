import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { InjuryRecord, RosterPlayer, Player } from '../types';
import { db } from '../services/db';
import { invalidateInjuryCache, STATUS_COLORS } from '../services/injuryData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  player: RosterPlayer;
  existingInjury?: InjuryRecord;
  currentPlayer: Player;
}

const INJURY_TYPES = ['Muscle', 'Soft Tissue', 'Bone', 'Joint', 'Ligament', 'Other'];
const BODY_PARTS = ['Head', 'Neck', 'Shoulder', 'Back', 'Chest', 'Arm', 'Elbow', 'Wrist', 'Hand', 'Finger', 'Hip', 'Thigh', 'Knee', 'Calf', 'Ankle', 'Foot', 'Toe'];
const DIAGNOSES = ['Strain', 'Sprain', 'Sore', 'Bruise', 'Break', 'Fracture', 'Tear', 'Concussion', 'Dislocation', 'Other'];
const AREAS = ['Left', 'Right', 'Bilateral', ''];
const STATUSES: InjuryRecord['currentStatus'][] = ['Day to Day', 'Questionable', 'IR / Out', 'Returned to Play'];

const InjuryModal: React.FC<Props> = ({ isOpen, onClose, onSave, player, existingInjury, currentPlayer }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [dateOfInjury, setDateOfInjury] = useState('');
  const [currentStatus, setCurrentStatus] = useState<InjuryRecord['currentStatus']>('Day to Day');
  const [injuryType, setInjuryType] = useState<string[]>([]);
  const [bodyPart, setBodyPart] = useState<string[]>([]);
  const [diagnosis, setDiagnosis] = useState<string[]>([]);
  const [areaOnBody, setAreaOnBody] = useState<InjuryRecord['areaOnBody']>('');
  const [notes, setNotes] = useState('');
  const [returnToPlayDate, setReturnToPlayDate] = useState('');
  const [estimatedReturnDate, setEstimatedReturnDate] = useState('');

  // Initialize form with existing injury data
  useEffect(() => {
    if (existingInjury) {
      setDateOfInjury(existingInjury.dateOfInjury || '');
      setCurrentStatus(existingInjury.currentStatus);
      setInjuryType(existingInjury.injuryType || []);
      setBodyPart(existingInjury.bodyPart || []);
      setDiagnosis(existingInjury.diagnosis || []);
      setAreaOnBody(existingInjury.areaOnBody || '');
      setNotes(existingInjury.notes || '');
      setReturnToPlayDate(existingInjury.returnToPlayDate || '');
      setEstimatedReturnDate(existingInjury.estimatedReturnDate || '');
    } else {
      // Default to today for new injuries
      setDateOfInjury(new Date().toISOString().split('T')[0]);
      setCurrentStatus('Day to Day');
      setInjuryType([]);
      setBodyPart([]);
      setDiagnosis([]);
      setAreaOnBody('');
      setNotes('');
      setReturnToPlayDate('');
      setEstimatedReturnDate('');
    }
  }, [existingInjury, isOpen]);

  const toggleArrayValue = (arr: string[], value: string, setter: (val: string[]) => void) => {
    if (arr.includes(value)) {
      setter(arr.filter(v => v !== value));
    } else {
      setter([...arr, value]);
    }
  };

  const handleSave = async () => {
    // Only require body part and injury type for NEW injuries
    if (!existingInjury) {
      if (bodyPart.length === 0) {
        setError('Please select at least one body part');
        return;
      }
      if (injuryType.length === 0) {
        setError('Please select at least one injury type');
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build injury data, avoiding undefined values (Firebase doesn't accept them)
      const injuryData: Record<string, unknown> = {
        playerName: player.name,
        coachSubmitting: currentPlayer.name,
        team: player.squad === '1sts and 2nds' ? 'Varsity' : 'Academy',
        dateOfInjury: dateOfInjury || 'TBD',
        currentStatus,
        updatedAt: Date.now(),
      };

      // Always include arrays (even if empty) to prevent .join() crashes in rendering
      injuryData.injuryType = injuryType;
      injuryData.bodyPart = bodyPart;
      injuryData.diagnosis = diagnosis;
      if (areaOnBody) injuryData.areaOnBody = areaOnBody;

      // Add optional fields only if they have values
      if (player.grade) injuryData.grade = player.grade;
      if (player.classYear) injuryData.classYear = player.classYear;
      if (notes) injuryData.notes = notes;
      if (currentStatus === 'Returned to Play') {
        injuryData.returnToPlayDate = returnToPlayDate || new Date().toISOString().split('T')[0];
      }
      if (currentStatus !== 'Returned to Play' && estimatedReturnDate) {
        injuryData.estimatedReturnDate = estimatedReturnDate;
      }

      console.log('[InjuryModal] Saving injury data:', injuryData);

      if (existingInjury) {
        const result = await db.updateInjury(existingInjury.id, injuryData as Partial<InjuryRecord>);
        if (!result) {
          throw new Error(`Injury record not found (ID: ${existingInjury.id})`);
        }
        console.log('[InjuryModal] Updated injury:', existingInjury.id);
      } else {
        await db.addInjury(injuryData as Omit<InjuryRecord, 'id'>);
        console.log('[InjuryModal] Added new injury for:', player.name);
      }

      invalidateInjuryCache();
      onSave();
      onClose();
    } catch (err: unknown) {
      console.error('[InjuryModal] Save error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to save: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={24} />
            <div>
              <h2 className="font-bold text-white">
                {existingInjury ? 'Edit Injury' : 'Report Injury'}
              </h2>
              <p className="text-sm text-neutral-400">{player.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Player Info (read-only) */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-neutral-800/50 rounded-lg">
            <div>
              <label className="text-xs text-neutral-500">Team</label>
              <p className="text-sm text-white">{player.squad === '1sts and 2nds' ? 'Varsity' : 'Academy'}</p>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Class</label>
              <p className="text-sm text-white">{player.classYear || 'N/A'} {player.grade ? `(Grade ${player.grade})` : ''}</p>
            </div>
          </div>

          {/* Date of Injury */}
          <div>
            <label className="text-sm text-neutral-400 block mb-2">Date of Injury</label>
            <input
              type="date"
              value={dateOfInjury}
              onChange={(e) => setDateOfInjury(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm text-neutral-400 block mb-2">Current Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(status => {
                const color = STATUS_COLORS[status];
                return (
                  <button
                    key={status}
                    onClick={() => setCurrentStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                      currentStatus === status
                        ? `${color.bg} ${color.text} ${color.border}`
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estimated Return Date (show for non-returned statuses) */}
          {currentStatus !== 'Returned to Play' && (
            <div>
              <label className="text-sm text-neutral-400 block mb-2">Estimated Return Date (optional)</label>
              <input
                type="date"
                value={estimatedReturnDate}
                onChange={(e) => setEstimatedReturnDate(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Return to Play Date (only show if status is Returned to Play) */}
          {currentStatus === 'Returned to Play' && (
            <div>
              <label className="text-sm text-neutral-400 block mb-2">Return to Play Date</label>
              <input
                type="date"
                value={returnToPlayDate}
                onChange={(e) => setReturnToPlayDate(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-green-500"
              />
            </div>
          )}

          {/* Injury Type */}
          <div>
            <label className="text-sm text-neutral-400 block mb-2">Injury Type (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {INJURY_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggleArrayValue(injuryType, type, setInjuryType)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    injuryType.includes(type)
                      ? 'bg-red-500 text-white'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Area on Body */}
          <div>
            <label className="text-sm text-neutral-400 block mb-2">Side of Body</label>
            <div className="flex flex-wrap gap-2">
              {AREAS.map(area => (
                <button
                  key={area || 'none'}
                  onClick={() => setAreaOnBody(area as InjuryRecord['areaOnBody'])}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    areaOnBody === area
                      ? 'bg-amber-500 text-black'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  {area || 'N/A'}
                </button>
              ))}
            </div>
          </div>

          {/* Body Part */}
          <div>
            <label className="text-sm text-neutral-400 block mb-2">Body Part (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {BODY_PARTS.map(part => (
                <button
                  key={part}
                  onClick={() => toggleArrayValue(bodyPart, part, setBodyPart)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    bodyPart.includes(part)
                      ? 'bg-red-500 text-white'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  {part}
                </button>
              ))}
            </div>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="text-sm text-neutral-400 block mb-2">Diagnosis (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {DIAGNOSES.map(diag => (
                <button
                  key={diag}
                  onClick={() => toggleArrayValue(diagnosis, diag, setDiagnosis)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    diagnosis.includes(diag)
                      ? 'bg-orange-500 text-white'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  {diag}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm text-neutral-400 block mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about the injury..."
              rows={3}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-900 border-t border-neutral-800 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-400 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                {existingInjury ? 'Update Injury' : 'Report Injury'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InjuryModal;
