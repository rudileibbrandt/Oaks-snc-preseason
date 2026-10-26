import React from 'react';
import { levelName } from '../services/standards';

// Level colors, Bronze to Elite (index -1 = below Bronze).
export const CHIP: Record<number, string> = {
  [-1]: 'bg-neutral-800 text-neutral-400',
  0: 'bg-orange-900/50 text-orange-300',
  1: 'bg-slate-500/25 text-slate-200',
  2: 'bg-amber-500/20 text-amber-400',
  3: 'bg-amber-400 text-black',
};

const LevelChip: React.FC<{ idx: number; small?: boolean }> = ({ idx, small }) => (
  <span className={`${small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'} font-bold rounded-full whitespace-nowrap ${CHIP[idx]}`}>
    {levelName(idx)}
  </span>
);

export default LevelChip;
