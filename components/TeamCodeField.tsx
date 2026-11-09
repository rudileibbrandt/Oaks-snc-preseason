import React from 'react';
import { KeyRound } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// The team join code box (sign-up and the Join your team screen).
const TeamCodeField: React.FC<Props> = ({ value, onChange, disabled }) => (
  <div>
    <label className="block text-neutral-400 text-sm mb-2 font-medium">Team code</label>
    <div className="relative">
      <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="OAKS-XXXX"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        className="w-full bg-black border border-neutral-800 py-3 pl-9 pr-3 rounded-lg text-white uppercase tracking-wider focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
      />
    </div>
    <p className="mt-1 text-xs text-neutral-500">Your coach has it. It keeps the team's data private.</p>
  </div>
);

export default TeamCodeField;
