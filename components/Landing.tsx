import React from 'react';
import { Shield, Dumbbell, Users } from 'lucide-react';
import { AppView } from '../types';

interface Props {
  onNavigate: (view: AppView) => void;
}

const Landing: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12 animate-fade-in text-center">
      
      <div className="space-y-4">
        <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
          <Shield size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          THE OAKS<br/>
          <span className="text-emerald-500">PERFORMANCE</span>
        </h1>
        <p className="text-slate-400 max-w-xs mx-auto">
          Pre-season Strength & Conditioning Program.
          <br/>Nov 19 - Jan 7.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <button
          onClick={() => onNavigate('ATHLETE_SELECT')}
          className="w-full group relative flex items-center justify-center p-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all active:scale-95 shadow-lg"
        >
          <div className="absolute left-4 opacity-70">
            <Dumbbell size={24} />
          </div>
          <span className="text-lg font-bold text-white">I AM AN ATHLETE</span>
        </button>

        <button
          onClick={() => onNavigate('COACH')}
          className="w-full group relative flex items-center justify-center p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all active:scale-95"
        >
          <div className="absolute left-4 opacity-70">
            <Users size={20} />
          </div>
          <span className="text-lg font-semibold text-slate-200">TEAM LEADERBOARD</span>
        </button>
      </div>
      
      <div className="text-xs text-slate-600 mt-auto">
        Train Hard. Stay Consistent. Win.
      </div>
    </div>
  );
};

export default Landing;