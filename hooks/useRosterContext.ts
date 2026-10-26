import { useEffect, useState } from 'react';
import { RosterClass, RosterPlayer } from '../types';
import { loadRosterContext, squadOf } from '../services/classYears';

// Classes and squad overrides for the hard-coded roster, shared and cached.
// `ready` is false until loaded, so screens can wait instead of showing the wrong squad.
export const useRosterClasses = () => {
  const [classes, setClasses] = useState<Record<string, RosterClass>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    loadRosterContext().then(c => { if (live) { setClasses(c.classes); setReady(true); } });
    return () => { live = false; };
  }, []);
  const squadInfo = (rp: RosterPlayer) => squadOf(rp, classes);
  return { classes, squadInfo, ready };
};
