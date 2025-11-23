import React, { useState } from 'react';
import Landing from './components/Landing';
import CoachDashboard from './components/CoachDashboard';
import AthleteView from './components/AthleteView';
import { AppView } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('LANDING');

  const renderContent = () => {
    switch (currentView) {
      case 'LANDING':
        return <Landing onNavigate={setCurrentView} />;
      case 'COACH':
        return <CoachDashboard onNavigate={setCurrentView} />;
      case 'ATHLETE_SELECT':
      case 'ATHLETE_DASHBOARD':
        return <AthleteView onNavigate={setCurrentView} />;
      default:
        return <Landing onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans selection:bg-emerald-500 selection:text-white">
      <main className="container mx-auto px-4 py-4 min-h-screen max-w-lg relative">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
