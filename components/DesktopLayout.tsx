import React from 'react';
import { Shield, Dumbbell, Users, ClipboardList, BarChart3, UserCog, LogOut, Medal, CalendarDays } from 'lucide-react';
import { AppView, Player } from '../types';
import { signOut, getCurrentUser } from '../services/auth';

interface Props {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
  children: React.ReactNode;
}

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ReactNode;
  coachOnly?: boolean;
  playerOnly?: boolean;
}

const DesktopLayout: React.FC<Props> = ({ currentView, onNavigate, currentPlayer, children }) => {
  const user = getCurrentUser();
  const isCoach = currentPlayer?.role === 'Coach';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const navItems: NavItem[] = [
    { view: 'LANDING', label: 'Home', icon: <Shield size={20} /> },
    { view: 'ATHLETE_SELECT', label: 'My Workouts', icon: <Dumbbell size={20} /> },
    { view: 'COACH', label: 'Stat Board', icon: <Users size={20} /> },
    { view: 'ROSTER', label: 'Players', icon: <ClipboardList size={20} /> },
    { view: 'CALENDAR', label: 'Calendar', icon: <CalendarDays size={20} /> },
    { view: 'STANDARDS', label: 'S&C Standards', icon: <Medal size={20} /> },
    { view: 'COACHES_CORNER', label: 'Coaches Corner', icon: <UserCog size={20} />, coachOnly: true },
    { view: 'RATING_ANALYTICS', label: 'Progression', icon: <BarChart3 size={20} />, playerOnly: true },
  ];

  const visibleItems = navItems.filter(item => {
    if (item.coachOnly && !isCoach) return false;
    if (item.playerOnly && isCoach) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — hidden on mobile, visible on lg+ */}
      <aside className="hidden lg:flex flex-col w-64 bg-neutral-900 border-r border-neutral-800 fixed h-full z-20">
        {/* Logo */}
        <div className="p-6 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <Shield size={22} className="text-black fill-current" />
            </div>
            <div>
              <div className="font-black text-white text-sm tracking-tight leading-none">DANVILLE</div>
              <div className="font-black text-amber-500 text-lg tracking-tight leading-none">OAKS</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1">
          {visibleItems.map(item => {
            const isActive = currentView === item.view ||
              (item.view === 'ATHLETE_SELECT' && (currentView === 'ATHLETE_DASHBOARD' || currentView === 'WORKOUT_SESSION')) ||
              (item.view === 'COACHES_CORNER' && currentView === 'DEPTH_CHART');

            return (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User info + sign out */}
        {user && (
          <div className="p-4 border-t border-neutral-800">
            <div className="text-xs text-neutral-500 truncate mb-2">
              {currentPlayer?.name || user.email}
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64">
        {/* Mobile: original constrained layout */}
        <div className="lg:hidden container mx-auto px-4 py-4 min-h-screen max-w-lg relative">
          {children}
        </div>
        {/* Desktop: expanded layout */}
        <div className="hidden lg:block px-8 py-6 min-h-screen max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DesktopLayout;
