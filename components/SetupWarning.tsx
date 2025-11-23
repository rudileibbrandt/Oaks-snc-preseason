import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { isConfigured } from '../services/db';

const SetupWarning: React.FC = () => {
  if (isConfigured) return null;

  return (
    <div className="bg-amber-500 text-black px-4 py-2 text-xs font-bold flex items-center justify-center sticky top-0 z-50">
      <AlertTriangle size={16} className="mr-2" />
      <span>Offline Mode: Cloud Sync Disabled. Update services/db.ts to go live.</span>
    </div>
  );
};

export default SetupWarning;