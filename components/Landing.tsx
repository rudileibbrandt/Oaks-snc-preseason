import React from 'react';
import { Shield, Dumbbell, Users, LogOut, ClipboardList, BarChart3, UserCog, Medal, CalendarDays } from 'lucide-react';
import { AppView, Player } from '../types';
import { signOut, getCurrentUser } from '../services/auth';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

const Landing: React.FC<Props> = ({ onNavigate, currentPlayer }) => {
  const user = getCurrentUser();
  
  const handleSignOut = async () => {
    try {
      await signOut();
      // App will handle redirect to login via auth state listener
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const isCoach = currentPlayer?.role === 'Coach';
  const isPlayer = currentPlayer?.role === 'Player';

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12 animate-fade-in text-center">
      {/* Sign Out Button */}
      {user && (
        <div className="absolute top-4 right-4">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg border border-neutral-800 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
      
      <div className="space-y-6">
        <div className="relative mx-auto">
          <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
          <div className="relative w-28 h-28 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto shadow-2xl border-4 border-neutral-900">
            <Shield size={56} className="text-black fill-current" />
          </div>
        </div>
        
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter leading-tight mb-2">
            DANVILLE
            <br/>
            <span className="text-amber-500 text-6xl">OAKS</span>
          </h1>
          <div className="h-1 w-24 bg-amber-500 mx-auto rounded-full mb-4"></div>
          <p className="text-neutral-400 font-medium uppercase tracking-widest text-xs">
            Strength & Conditioning Portal
          </p>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4 px-4">
        {/* MY WORKOUTS with Stat Board sub-item */}
        {(isPlayer || isCoach) && (
          <div className="space-y-0">
            <button
              onClick={() => onNavigate('ATHLETE_SELECT')}
              className="w-full group relative flex items-center justify-between p-5 bg-amber-500 hover:bg-amber-400 rounded-t-xl transition-all active:scale-95 shadow-[0_10px_20px_rgba(245,158,11,0.2)] border-t border-amber-300"
            >
              <div className="flex items-center">
                <div className="p-2 bg-black/20 rounded-lg mr-4">
                  <Dumbbell size={24} className="text-black" />
                </div>
                <div className="text-left">
                  <span className="block text-black font-black text-lg">MY WORKOUTS</span>
                  <span className="text-neutral-900 font-medium text-xs">Log your workout</span>
                </div>
              </div>
            </button>
            <button
              onClick={() => onNavigate('COACH')}
              className="w-full flex items-center gap-3 px-5 py-3 bg-amber-600/30 hover:bg-amber-600/40 border border-amber-500/20 border-t-0 rounded-b-xl transition-all active:scale-95"
            >
              <Users size={16} className="text-amber-400" />
              <span className="text-amber-300 font-semibold text-sm">Stat Board</span>
              <span className="text-amber-500/60 text-xs ml-auto">Team stats</span>
            </button>
          </div>
        )}

        {/* Stat Board standalone for non-player/coach users */}
        {!isPlayer && !isCoach && (
          <button
            onClick={() => onNavigate('COACH')}
            className="w-full group relative flex items-center justify-between p-5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all active:scale-95"
          >
            <div className="flex items-center">
               <div className="p-2 bg-neutral-800 rounded-lg mr-4">
                 <Users size={24} className="text-neutral-300" />
               </div>
               <div className="text-left">
                 <span className="block text-neutral-200 font-bold text-lg">STAT BOARD</span>
                 <span className="text-neutral-500 text-xs">View team stats</span>
               </div>
            </div>
          </button>
        )}

        {/* Player Roster - visible to all users for 360 ratings */}
        <button
          onClick={() => onNavigate('ROSTER')}
          className="w-full group relative flex items-center justify-between p-5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all active:scale-95"
        >
          <div className="flex items-center">
             <div className="p-2 bg-neutral-800 rounded-lg mr-4">
               <ClipboardList size={24} className="text-neutral-300" />
             </div>
             <div className="text-left">
               <span className="block text-neutral-200 font-bold text-lg">PLAYERS</span>
               <span className="text-neutral-500 text-xs">Photos, groups & player feedback</span>
             </div>
          </div>
        </button>

        {/* Calendar - everyone */}
        <button
          onClick={() => onNavigate('CALENDAR')}
          className="w-full group relative flex items-center justify-between p-5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all active:scale-95"
        >
          <div className="flex items-center">
             <div className="p-2 bg-neutral-800 rounded-lg mr-4">
               <CalendarDays size={24} className="text-neutral-300" />
             </div>
             <div className="text-left">
               <span className="block text-neutral-200 font-bold text-lg">CALENDAR</span>
               <span className="text-neutral-500 text-xs">Practices, matches, testing &amp; S&amp;C sessions</span>
             </div>
          </div>
        </button>

        {/* S&C Standards - everyone */}
        <button
          onClick={() => onNavigate('STANDARDS')}
          className="w-full group relative flex items-center justify-between p-5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all active:scale-95"
        >
          <div className="flex items-center">
             <div className="p-2 bg-neutral-800 rounded-lg mr-4">
               <Medal size={24} className="text-neutral-300" />
             </div>
             <div className="text-left">
               <span className="block text-neutral-200 font-bold text-lg">S&amp;C STANDARDS</span>
               <span className="text-neutral-500 text-xs">{isCoach ? 'Testing days & team levels' : 'Your level on every test'}</span>
             </div>
          </div>
        </button>

        {/* Coaches Corner - coach-only hub */}
        {isCoach && (
          <button
            onClick={() => onNavigate('COACHES_CORNER')}
            className="w-full group relative flex items-center justify-between p-5 bg-neutral-900 hover:bg-neutral-800 border border-amber-500/30 rounded-xl transition-all active:scale-95"
          >
            <div className="flex items-center">
               <div className="p-2 bg-amber-500/20 rounded-lg mr-4">
                 <UserCog size={24} className="text-amber-400" />
               </div>
               <div className="text-left">
                 <span className="block text-neutral-200 font-bold text-lg">COACHES CORNER</span>
                 <span className="text-neutral-500 text-xs">Depth chart, analytics, injuries & more</span>
               </div>
            </div>
          </button>
        )}

        {/* Rating Analytics - visible to non-coaches for their own feedback */}
        {!isCoach && (
          <button
            onClick={() => onNavigate('RATING_ANALYTICS')}
            className="w-full group relative flex items-center justify-between p-5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all active:scale-95"
          >
            <div className="flex items-center">
               <div className="p-2 bg-neutral-800 rounded-lg mr-4">
                 <BarChart3 size={24} className="text-neutral-300" />
               </div>
               <div className="text-left">
                 <span className="block text-neutral-200 font-bold text-lg">PLAYER PROGRESSION</span>
                 <span className="text-neutral-500 text-xs">360° feedback & skill insights</span>
               </div>
            </div>
          </button>
        )}
      </div>
      
      <div className="text-xs text-neutral-600 mt-auto font-mono">
        EST. 2007 • DANVILLE, CA
      </div>
    </div>
  );
};

export default Landing;