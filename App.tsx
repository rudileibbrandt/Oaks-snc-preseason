import React, { useState, useEffect } from 'react';
import Landing from './components/Landing';
import CoachDashboard from './components/CoachDashboard';
import AthleteView from './components/AthleteView';
import TrackerView from './components/TrackerView';
import SetupWarning from './components/SetupWarning';
import Login from './components/Login';
import RoleSelection from './components/RoleSelection';
import { AppView, Player } from './types';
import { onAuthStateChanged } from './services/auth';
import { db } from './services/db';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('LOGIN');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [coachDashboardRefresh, setCoachDashboardRefresh] = useState(0);

  useEffect(() => {
    // Check auth state and check if user has a profile
    const unsubscribe = onAuthStateChanged(async (user) => {
      setIsAuthenticated(!!user);
      
      if (user) {
        // User is logged in - check if they have a profile
        console.log('[App] User authenticated, checking profile...');
        try {
          // Add timeout to prevent hanging
          const player = await Promise.race([
            db.getOrCreatePlayerForUser(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Profile check timeout after 15 seconds')), 15000)
            )
          ]) as Player;
          
          setCurrentPlayer(player);
          setIsLoading(false);
          
          // If player has a role, go to landing
          if (player.role) {
            setNeedsRoleSelection(false);
            if (currentView === 'LOGIN') {
              setCurrentView('LANDING');
            }
          } else {
            // No role set - need role selection
            setNeedsRoleSelection(true);
          }
        } catch (error: any) {
          console.error('[App] Error getting player:', error);
          // If error is about missing profile, show role selection
          // This is expected for new users - they need to complete registration
          const errorMessage = error?.message || error?.toString() || '';
          if (errorMessage.includes('not found') || 
              errorMessage.includes('complete registration') ||
              errorMessage.includes('timeout') ||
              errorMessage.includes('User profile not found')) {
            console.log('[App] New user detected - showing role selection');
            setNeedsRoleSelection(true);
            setIsLoading(false);
          } else {
            console.error('Failed to get player:', error);
            setIsLoading(false);
            // Still show role selection as fallback for any error
            setNeedsRoleSelection(true);
          }
        }
      } else {
        // User is not logged in, show login
        setIsLoading(false);
        setCurrentView('LOGIN');
        setNeedsRoleSelection(false);
        setCurrentPlayer(null);
      }
    });

    return () => unsubscribe();
  }, [currentView]);

  const handleLoginSuccess = async () => {
    setIsAuthenticated(true);
    // Check if user has a profile
    try {
      const player = await db.getOrCreatePlayerForUser();
      setCurrentPlayer(player);
      
      if (player.role) {
        setNeedsRoleSelection(false);
        setCurrentView('LANDING');
      } else {
        setNeedsRoleSelection(true);
      }
    } catch (error: any) {
      // If error is about missing profile, show role selection
      // This is expected for new users - they need to complete registration
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage.includes('not found') || 
          errorMessage.includes('complete registration') ||
          errorMessage.includes('User profile not found')) {
        console.log('[App] New user detected - showing role selection');
        setNeedsRoleSelection(true);
      } else {
        console.error('Failed to get player:', error);
        // Still show role selection as fallback
        setNeedsRoleSelection(true);
      }
    }
  };

  // Trigger refresh when navigating to coach dashboard
  useEffect(() => {
    if (currentView === 'COACH') {
      setCoachDashboardRefresh(prev => prev + 1);
    }
  }, [currentView]);

  const handleSignUpSuccess = () => {
    // For new signups, immediately show role selection
    setIsAuthenticated(true);
    setNeedsRoleSelection(true);
    setIsLoading(false);
  };

  const handleRoleSelectionComplete = async () => {
    // Reload player after role selection
    try {
      const player = await db.getOrCreatePlayerForUser();
      setCurrentPlayer(player);
      setNeedsRoleSelection(false);
      setCurrentView('LANDING');
    } catch (error) {
      console.error('Failed to reload player:', error);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[85vh]">
          <div className="text-neutral-400">Loading...</div>
        </div>
      );
    }

    // Show role selection if user is authenticated but needs to register
    if (needsRoleSelection && isAuthenticated) {
      return <RoleSelection onComplete={handleRoleSelectionComplete} />;
    }

    if (!isAuthenticated || currentView === 'LOGIN') {
      return <Login onLoginSuccess={handleLoginSuccess} onSignUpSuccess={handleSignUpSuccess} />;
    }

    // Show role selection if user doesn't have a role yet
    if (needsRoleSelection) {
      return <RoleSelection onComplete={handleRoleSelectionComplete} />;
    }

    switch (currentView) {
      case 'LANDING':
        return <Landing onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
      case 'COACH':
        return <CoachDashboard onNavigate={setCurrentView} currentPlayer={currentPlayer} refreshTrigger={coachDashboardRefresh} />;
      case 'TRACKER':
        return <TrackerView onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
      case 'ATHLETE_SELECT':
      case 'ATHLETE_DASHBOARD':
        return <AthleteView onNavigate={setCurrentView} />;
      default:
        return <Landing onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans selection:bg-amber-500 selection:text-black">
      <SetupWarning />
      <main className="container mx-auto px-4 py-4 min-h-screen max-w-lg relative">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;