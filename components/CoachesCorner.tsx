import React, { useState } from 'react';
import { ArrowLeft, Layers, BarChart3, AlertTriangle, UserCog } from 'lucide-react';
import { AppView, Player } from '../types';
import DepthChart from './DepthChart';
import RatingAnalytics from './RatingAnalytics';
import InjuryTracker from './InjuryTracker';
import CoachActivity from './CoachActivity';

interface Props {
  onNavigate: (view: AppView) => void;
  currentPlayer?: Player | null;
}

type SubView = 'hub' | 'depth_chart' | 'analytics' | 'injuries' | 'activity';

const CoachesCorner: React.FC<Props> = ({ onNavigate, currentPlayer }) => {
  const [subView, setSubView] = useState<SubView>('hub');

  const handleBack = () => {
    if (subView === 'hub') {
      onNavigate('LANDING');
    } else {
      setSubView('hub');
    }
  };

  // Navigate handler that sub-components call — intercept LANDING to go back to hub
  const subNavigate = (view: AppView) => {
    if (view === 'LANDING') {
      setSubView('hub');
    } else {
      onNavigate(view);
    }
  };

  if (subView === 'depth_chart') {
    return <DepthChart onNavigate={subNavigate} currentPlayer={currentPlayer} />;
  }

  if (subView === 'analytics') {
    return <RatingAnalytics onNavigate={subNavigate} currentPlayer={currentPlayer} />;
  }

  if (subView === 'injuries') {
    return <InjuryTracker onNavigate={subNavigate} currentPlayer={currentPlayer} />;
  }

  if (subView === 'activity') {
    return <CoachActivity onNavigate={subNavigate} currentPlayer={currentPlayer} />;
  }

  // Hub view
  const menuItems = [
    {
      key: 'depth_chart' as SubView,
      icon: Layers,
      title: 'DEPTH CHART',
      subtitle: 'Position rankings by rating',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/20',
    },
    {
      key: 'analytics' as SubView,
      icon: BarChart3,
      title: 'PLAYER PROGRESSION',
      subtitle: '360° feedback & skill insights',
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
    },
    {
      key: 'injuries' as SubView,
      icon: AlertTriangle,
      title: 'INJURY TRACKER',
      subtitle: 'Player injuries & return-to-play',
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/20',
    },
    {
      key: 'activity' as SubView,
      icon: UserCog,
      title: 'COACH ACTIVITY',
      subtitle: 'Ratings overview, accounts & merges',
      iconColor: 'text-neutral-300',
      iconBg: 'bg-neutral-800',
    },
  ];

  return (
    <div className="animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-neutral-400" />
        </button>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">COACHES CORNER</h1>
          <p className="text-xs text-neutral-500">Coach tools & analytics</p>
        </div>
      </div>

      {/* Menu items */}
      <div className="space-y-3">
        {menuItems.map(item => (
          <button
            key={item.key}
            onClick={() => setSubView(item.key)}
            className="w-full group relative flex items-center justify-between p-5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all active:scale-95"
          >
            <div className="flex items-center">
              <div className={`p-2.5 ${item.iconBg} rounded-lg mr-4`}>
                <item.icon size={22} className={item.iconColor} />
              </div>
              <div className="text-left">
                <span className="block text-neutral-200 font-bold text-base">{item.title}</span>
                <span className="text-neutral-500 text-xs">{item.subtitle}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CoachesCorner;
