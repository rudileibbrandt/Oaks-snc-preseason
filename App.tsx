import React, { useState, useEffect, useRef } from 'react';
import Landing from './components/Landing';
import CoachDashboard from './components/CoachDashboard';
import AthleteView from './components/AthleteView';
import TrackerView from './components/TrackerView';
import PlayerList from './components/PlayerList';
import SetupWarning from './components/SetupWarning';
import Login from './components/Login';
import RoleSelection from './components/RoleSelection';
import StandardsView from './components/StandardsView';
import CalendarView from './components/CalendarView';
import RatingAnalytics from './components/RatingAnalytics';
import CoachesCorner from './components/CoachesCorner';
import MergePrompt, { isDismissed } from './components/MergePrompt';
import DesktopLayout from './components/DesktopLayout';
import { AppView, Player } from './types';
import { onAuthStateChanged, signOut } from './services/auth';
import { profileOutcome, ProfileOutcome } from './services/profileLoad';
import { db, migrateRatingsTo5PointScale, findDuplicatesByName } from './services/db';
import { invalidateRatingsCache } from './services/ratingData';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('LOGIN');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [profileError, setProfileError] = useState(false); // profile lookup failed or timed out
  const lookupId = useRef(0); // only the newest profile lookup may change the screen
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [coachDashboardRefresh, setCoachDashboardRefresh] = useState(0);
  const [duplicatePlayers, setDuplicatePlayers] = useState<Player[]>([]);
  const [showMergePrompt, setShowMergePrompt] = useState(false);

  const checkForDuplicates = async (player: Player) => {
    try {
      const dupes = await findDuplicatesByName(player);
      if (dupes.length > 0 && !isDismissed(player.id, dupes)) {
        setDuplicatePlayers(dupes);
        setShowMergePrompt(true);
      }
    } catch (e) {
      console.error('[App] Error checking for duplicates:', e);
    }
  };

  // Look up the signed-in user's profile. Only a definite "no profile" shows the sign-up screen;
  // a slow or failed lookup shows Try again (services/profileLoad.ts).
  const loadProfile = async () => {
    const id = ++lookupId.current;
    setIsLoading(true);
    setProfileError(false);
    let outcome: ProfileOutcome;
    let player: Player | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      player = await Promise.race([
        db.getOrCreatePlayerForUser(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Profile check timeout after 15 seconds')), 15000);
        }),
      ]);
      outcome = profileOutcome({ player });
    } catch (error) {
      console.error('[App] Profile lookup failed:', error);
      outcome = profileOutcome({ error });
    } finally {
      clearTimeout(timer);
    }
    // A newer lookup, or a sign-out, has started since: this answer is stale.
    if (id !== lookupId.current) return;
    if (outcome === 'ready' && player) {
      setCurrentPlayer(player);
      setNeedsRoleSelection(false);
      setCurrentView(v => (v === 'LOGIN' ? 'LANDING' : v));
      checkForDuplicates(player);
    } else if (outcome === 'register') {
      setNeedsRoleSelection(true);
    } else {
      setProfileError(true);
    }
    setIsLoading(false);
  };

  const handleRetry = () => { loadProfile(); };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error('[App] Sign out failed:', e);
    }
  };

  useEffect(() => {
    // Runs once. Firebase calls back on sign-in and sign-out, not on every screen change.
    const unsubscribe = onAuthStateChanged(async (user) => {
      setIsAuthenticated(!!user);

      if (user) {
        migrateRatingsTo5PointScale().catch(e => console.error('[App] Migration error:', e));
        // One-time fix: Carter White Coach→Player
        if (!localStorage.getItem('fix_carter_white_role')) {
          db.getPlayers().then(players => {
            const carter = players.find(p => p.name === 'Carter White' && p.role === 'Coach');
            if (carter) {
              db.updatePlayerRole(carter.id, 'Player').then(() => {
                console.log('[App] Fixed Carter White role to Player');
                localStorage.setItem('fix_carter_white_role', 'done');
              });
            } else {
              localStorage.setItem('fix_carter_white_role', 'done');
            }
          }).catch(e => console.error('[App] Carter White fix error:', e));
        }
        await loadProfile();
      } else {
        lookupId.current++; // drop any lookup still running for the previous sign-in
        setIsLoading(false);
        setCurrentView('LOGIN');
        setNeedsRoleSelection(false);
        setProfileError(false);
        setCurrentPlayer(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = () => {
    // The sign-in listener above loads the profile.
    setIsAuthenticated(true);
  };

  // Trigger refresh when navigating to coach dashboard
  useEffect(() => {
    if (currentView === 'COACH') {
      setCoachDashboardRefresh(prev => prev + 1);
    }
  }, [currentView]);

  const handleSignUpSuccess = () => {
    // The sign-in listener looks the new account up, finds no profile and shows the role screen.
    setIsAuthenticated(true);
  };

  const handleRoleSelectionComplete = async () => {
    // The profile now exists; load it the same way as at sign-in.
    await loadProfile();
  };

  const handleMergeComplete = async () => {
    setShowMergePrompt(false);
    setDuplicatePlayers([]);
    invalidateRatingsCache();
    // Reload player (may now redirect to canonical account)
    try {
      const player = await db.getOrCreatePlayerForUser();
      setCurrentPlayer(player);
    } catch (error) {
      console.error('[App] Error reloading player after merge:', error);
    }
    setCurrentView('LANDING');
  };

  const handleMergeDismiss = () => {
    setShowMergePrompt(false);
    setDuplicatePlayers([]);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[85vh]">
          <div className="text-neutral-400">Loading...</div>
        </div>
      );
    }

    if (profileError && isAuthenticated) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] text-center gap-4">
          <p className="text-white font-bold">Can't reach the server</p>
          <p className="text-sm text-neutral-400 max-w-xs">Your profile didn't load. Check your connection, then try again.</p>
          <button onClick={handleRetry} className="px-6 py-3 rounded-lg bg-amber-500 text-black font-bold">Try again</button>
          <button onClick={handleSignOut} className="text-sm text-neutral-500 hover:text-white">Sign out</button>
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
      case 'ROSTER':
        return <PlayerList onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
      case 'RATING_ANALYTICS':
        return <RatingAnalytics onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
      case 'CALENDAR':
        return <CalendarView onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
      case 'STANDARDS':
        return <StandardsView onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
      case 'COACHES_CORNER':
      case 'DEPTH_CHART':
        if (currentPlayer?.role !== 'Coach') return <Landing onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
        return <CoachesCorner onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
      case 'ATHLETE_SELECT':
      case 'ATHLETE_DASHBOARD':
        return <AthleteView onNavigate={setCurrentView} />;
      default:
        return <Landing onNavigate={setCurrentView} currentPlayer={currentPlayer} />;
    }
  };

  // Views that should NOT get the desktop sidebar (pre-auth flows)
  const isPreAuthView = !isAuthenticated || needsRoleSelection || profileError || currentView === 'LOGIN';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans selection:bg-amber-500 selection:text-black">
      <SetupWarning />
      {isPreAuthView ? (
        <main className="container mx-auto px-4 py-4 min-h-screen max-w-lg relative">
          {renderContent()}
        </main>
      ) : (
        <DesktopLayout
          currentView={currentView}
          onNavigate={setCurrentView}
          currentPlayer={currentPlayer}
        >
          {renderContent()}
          {showMergePrompt && currentPlayer && duplicatePlayers.length > 0 && (
            <MergePrompt
              currentPlayer={currentPlayer}
              duplicates={duplicatePlayers}
              onMergeComplete={handleMergeComplete}
              onDismiss={handleMergeDismiss}
            />
          )}
        </DesktopLayout>
      )}
    </div>
  );
};

export default App;