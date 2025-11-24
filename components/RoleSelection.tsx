import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, User, Users } from 'lucide-react';
import { db } from '../services/db';
import { getCurrentUser } from '../services/auth';

interface Props {
  onComplete: () => void;
}

const RoleSelection: React.FC<Props> = ({ onComplete }) => {
  const [selectedRole, setSelectedRole] = useState<'Player' | 'Coach' | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'Forward' | 'Back' | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [needsNameInput, setNeedsNameInput] = useState(false);

  useEffect(() => {
    // Check if we can get name from user profile
    const user = getCurrentUser();
    if (user) {
      const displayName = user.displayName;
      const email = user.email;
      
      if (displayName) {
        // Try to split display name into first and last
        const nameParts = displayName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          setFirstName(nameParts[0]);
          setLastName(nameParts.slice(1).join(' '));
          setNeedsNameInput(false);
        } else if (nameParts.length === 1) {
          setFirstName(nameParts[0]);
          setNeedsNameInput(true); // Need last name
        } else {
          setNeedsNameInput(true);
        }
      } else if (email) {
        // Try to extract name from email (e.g., john.doe@example.com)
        const emailName = email.split('@')[0];
        const emailParts = emailName.split(/[._-]/);
        if (emailParts.length >= 2) {
          setFirstName(emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1));
          setLastName(emailParts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '));
          setNeedsNameInput(true); // Let them verify/edit
        } else {
          setNeedsNameInput(true);
        }
      } else {
        setNeedsNameInput(true);
      }
    } else {
      setNeedsNameInput(true);
    }
  }, []);

  const handleSubmit = async () => {
    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    if (selectedRole === 'Player' && !selectedPosition) {
      setError('Please select a position');
      return;
    }

    if (needsNameInput) {
      if (!firstName.trim()) {
        setError('Please enter your first name');
        return;
      }
      if (!lastName.trim()) {
        setError('Please enter your last name');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Build full name
      const fullName = needsNameInput 
        ? `${firstName.trim()} ${lastName.trim()}`.trim()
        : undefined;
      
      await db.getOrCreatePlayerForUser(
        selectedRole,
        selectedRole === 'Player' ? selectedPosition : undefined,
        fullName
      );
      onComplete();
    } catch (err: any) {
      console.error('Role selection failed:', err);
      setError(err.message || 'Failed to create profile. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] animate-fade-in">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Welcome to The Oaks</h1>
          <p className="text-neutral-400 text-sm">Complete your profile</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-start text-red-500 text-sm">
            <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Role Selection */}
        <div>
          <label className="block text-neutral-400 text-sm mb-3 font-medium">I am a...</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setSelectedRole('Player');
                setError(null);
              }}
              disabled={isSubmitting}
              className={`p-6 rounded-xl border-2 font-bold transition-all ${
                selectedRole === 'Player'
                  ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-amber-500/50'
              } disabled:opacity-50`}
            >
              <User size={24} className="mx-auto mb-2" />
              <div>Player</div>
            </button>

            <button
              onClick={() => {
                setSelectedRole('Coach');
                setError(null);
              }}
              disabled={isSubmitting}
              className={`p-6 rounded-xl border-2 font-bold transition-all ${
                selectedRole === 'Coach'
                  ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-amber-500/50'
              } disabled:opacity-50`}
            >
              <Users size={24} className="mx-auto mb-2" />
              <div>Coach</div>
            </button>
          </div>
        </div>

        {/* Name Input (if needed) */}
        {needsNameInput && (
          <div className="space-y-3">
            <div>
              <label className="block text-neutral-400 text-sm mb-2 font-medium">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setError(null);
                }}
                placeholder="John"
                disabled={isSubmitting}
                className="w-full bg-black border border-neutral-800 p-3 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
                required
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-sm mb-2 font-medium">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setError(null);
                }}
                placeholder="Doe"
                disabled={isSubmitting}
                className="w-full bg-black border border-neutral-800 p-3 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
                required
              />
            </div>
          </div>
        )}

        {/* Position Selection (only for Players) */}
        {selectedRole === 'Player' && (
          <div>
            <label className="block text-neutral-400 text-sm mb-3 font-medium">Position Group</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setSelectedPosition('Forward');
                  setError(null);
                }}
                disabled={isSubmitting}
                className={`p-4 rounded-xl border font-bold transition-all ${
                  selectedPosition === 'Forward'
                    ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-amber-500/50'
                } disabled:opacity-50`}
              >
                Forward
              </button>

              <button
                onClick={() => {
                  setSelectedPosition('Back');
                  setError(null);
                }}
                disabled={isSubmitting}
                className={`p-4 rounded-xl border font-bold transition-all ${
                  selectedPosition === 'Back'
                    ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-amber-500/50'
                } disabled:opacity-50`}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={
            isSubmitting || 
            !selectedRole || 
            (selectedRole === 'Player' && !selectedPosition) ||
            (needsNameInput && (!firstName.trim() || !lastName.trim()))
          }
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-4 px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="mr-2 animate-spin" />
              Creating Profile...
            </>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  );
};

export default RoleSelection;

