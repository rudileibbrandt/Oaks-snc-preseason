// A player's current height and weight, worked out from their entries (BodyMeasurement), their
// testing-day bodyweights and, if neither has anything, the hard-coded roster file.
// Pure functions only, so they can be tested without Firebase (services/bodyStats.test.ts).
import type { BodyMeasurement, RosterPlayer, TestResult, TestSession } from '../types';

// Roster heights look like 5'9" — returns total inches.
export const parseHeight = (s?: string): number | undefined => {
  const match = s?.match(/^\s*(\d)\s*'\s*(\d{1,2})?/);
  if (!match) return undefined;
  return Number(match[1]) * 12 + Number(match[2] ?? 0);
};

export const formatHeight = (inches: number): string => `${Math.floor(inches / 12)}'${inches % 12}"`;

// Error text, or null if the number is plausible for a high school player.
// Same ranges as the bodyMeasurements rule in firestore.rules: change both together.
export const checkHeight = (inches: number): string | null =>
  Number.isFinite(inches) && inches >= 48 && inches <= 90 ? null : 'Height should be between 4\'0" and 7\'6"';
export const checkWeight = (lb: number): string | null =>
  Number.isFinite(lb) && lb >= 80 && lb <= 400 ? null : 'Weight should be between 80 and 400 lb';

export type WeightSource = 'self' | 'coach' | 'test';

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weightLb: number;
  source: WeightSource;
  by: string;
  at: number; // when it was entered, to order same-day entries
}

export interface BodyStats {
  heightIn?: number;
  heightDate?: string; // missing = from the roster file
  weightLb?: number;
  weightDate?: string; // missing = from the roster file
  weightHistory: WeightEntry[]; // newest first; roster-file weight is not included
}

const newestFirst = (a: { date: string; at: number }, b: { date: string; at: number }) =>
  b.date.localeCompare(a.date) || b.at - a.at;

export const bodyStatsFor = ({ nameKey, roster, measurements, testResults, testSessions }: {
  nameKey: string;
  roster?: RosterPlayer;
  measurements: BodyMeasurement[];
  testResults: TestResult[];
  testSessions: TestSession[];
}): BodyStats => {
  const mine = measurements.filter(x => x.nameKey === nameKey);
  const sessionDate = new Map(testSessions.map(s => [s.id, s.date]));

  const weightHistory: WeightEntry[] = [
    ...mine.filter(x => x.weightLb != null).map(x => ({
      date: x.date, weightLb: x.weightLb!, at: x.createdAt, by: x.enteredBy,
      source: (x.enteredByRole === 'Coach' ? 'coach' : 'self') as WeightSource,
    })),
    ...testResults.flatMap(r => {
      const date = sessionDate.get(r.sessionId);
      if (r.nameKey !== nameKey || r.bodyweight == null || !date) return [];
      return [{ date, weightLb: r.bodyweight, at: r.updatedAt, by: r.enteredBy, source: 'test' as WeightSource }];
    }),
  ].sort(newestFirst);

  const latestHeight = mine.filter(x => x.heightIn != null)
    .map(x => ({ date: x.date, at: x.createdAt, heightIn: x.heightIn! }))
    .sort(newestFirst)[0];

  return {
    heightIn: latestHeight?.heightIn ?? parseHeight(roster?.height),
    heightDate: latestHeight?.date,
    weightLb: weightHistory[0]?.weightLb ?? roster?.weight,
    weightDate: weightHistory[0]?.date,
    weightHistory,
  };
};
