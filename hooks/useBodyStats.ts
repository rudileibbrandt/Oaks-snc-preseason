import { useCallback, useEffect, useState } from 'react';
import { BodyMeasurement, RosterPlayer, TestResult, TestSession } from '../types';
import { db } from '../services/db';
import { normalizeName } from '../services/alumni';
import { bodyStatsFor } from '../services/bodyStats';

// Loads height/weight entries and testing-day weigh-ins once, and works out any player's current numbers.
export const useBodyStats = () => {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testSessions, setTestSessions] = useState<TestSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([db.getBodyMeasurements(), db.getTestResults(), db.getTestSessions()])
      .then(([m, r, s]) => { if (live) { setMeasurements(m); setTestResults(r); setTestSessions(s); } })
      .catch(e => console.error('[useBodyStats] load failed', e))
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);

  const statsFor = useCallback((name: string, roster?: RosterPlayer) =>
    bodyStatsFor({ nameKey: normalizeName(name), roster, measurements, testResults, testSessions }),
  [measurements, testResults, testSessions]);

  const add = useCallback(async (entry: Omit<BodyMeasurement, 'id' | 'enteredByUserId'>) => {
    const saved = await db.addBodyMeasurement(entry);
    setMeasurements(prev => [...prev, saved]);
  }, []);

  return { statsFor, add, ready };
};
