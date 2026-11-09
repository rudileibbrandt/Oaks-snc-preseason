import { useEffect, useState } from 'react';
import { RosterClass, RosterPlayer } from '../types';
import { groupOf as groupFrom, invalidateRosterContext, loadRosterContext, positionsOf as positionsFrom, squadOf } from '../services/classYears';

// Classes, squad, training-group and position overrides for the hard-coded roster, shared and cached.
// `ready` is false until loaded, so screens can wait instead of showing the wrong squad.
export const useRosterClasses = () => {
  const [classes, setClasses] = useState<Record<string, RosterClass>>({});
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    loadRosterContext().then(c => { if (live) { setClasses(c.classes); setReady(true); } });
    return () => { live = false; };
  }, [version]);
  // After saving a change: drop the shared cache and load again.
  const reload = () => { invalidateRosterContext(); setVersion(v => v + 1); };
  const squadInfo = (rp: RosterPlayer) => squadOf(rp, classes);
  const groupOf = (rp: RosterPlayer) => groupFrom(rp, classes);
  const positionsOf = (rp: RosterPlayer) => positionsFrom(rp, classes);
  return { classes, squadInfo, groupOf, positionsOf, ready, reload };
};
