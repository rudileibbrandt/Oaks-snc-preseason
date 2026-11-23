// One testing day, seen on its own (the shareable day card on Me): each test done that day,
// whether it beat every earlier result (PR), and the change since the last time it was done.
import { pctChange } from './improvement.ts';

export interface DayScores {
  sessionId: string;
  date: string;                                  // YYYY-MM-DD
  scores: Record<string, number | undefined>;    // test key → graded score (undefined = not done)
}

export interface DayTest {
  value: number;
  first: boolean;            // nothing earlier on this test
  pr: boolean;               // better than every earlier result
  deltaPct: number | undefined; // vs the previous time it was done; + = better
}

export const dayResults = (
  days: DayScores[], sessionId: string, lowerIsBetter: Record<string, boolean>,
): Record<string, DayTest> => {
  const day = days.find(d => d.sessionId === sessionId);
  if (!day) return {};
  const earlier = days.filter(d => d.date < day.date).sort((a, b) => a.date.localeCompare(b.date));
  const out: Record<string, DayTest> = {};
  for (const [test, value] of Object.entries(day.scores)) {
    if (value === undefined) continue;
    const lower = !!lowerIsBetter[test];
    const before = earlier.map(d => d.scores[test]).filter((v): v is number => v !== undefined);
    if (before.length === 0) { out[test] = { value, first: true, pr: false, deltaPct: undefined }; continue; }
    const pr = before.every(b => (lower ? value < b : value > b));
    out[test] = { value, first: false, pr, deltaPct: pctChange(before[before.length - 1], value, lower) };
  }
  return out;
};
