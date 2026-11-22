// Glue between saved test results and the improvement maths (services/improvement.ts).
import { TeamGoal, TestResult, TestSession } from '../types';
import { LEVELS, TESTS, STANDARDS, StandardTest, PositionGroup, testSummary } from './standards';
import type { LowerIsBetter, Series } from './improvement';

export const LOWER: LowerIsBetter = Object.fromEntries(TESTS.map(t => [t.key, t.lowerIsBetter]));
export const TEST_KEYS = TESTS.map(t => t.key);

// One player's results this season, per test, oldest first.
export const seriesOf = (results: TestResult[], sessions: TestSession[]): Record<StandardTest, Series | undefined> =>
  Object.fromEntries(TESTS.map(t => {
    const s = testSummary(results, sessions, t.key);
    return [t.key, s?.list.map(x => ({ date: x.date, value: x.value }))];
  })) as Record<StandardTest, Series | undefined>;

export const bronzeLine = (group: PositionGroup) => STANDARDS[group].bronco[0];

export const bestOf = (s: Series | undefined, lowerIsBetter: boolean) =>
  s && s.length ? s.reduce((a, b) => (lowerIsBetter ? (b.value < a.value ? b : a) : (b.value > a.value ? b : a))).value : undefined;

// Local calendar date, YYYY-MM-DD (testing days are stored that way).
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// The next testing day, today included.
export const nextTestingDay = (sessions: TestSession[], today = localToday()) =>
  [...sessions].filter(s => s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];

// The most recent testing day that has results.
export const lastTestingDay = (sessions: TestSession[], results: TestResult[], today = localToday()) => {
  const withResults = new Set(results.map(r => r.sessionId));
  return [...sessions].filter(s => s.date <= today && withResults.has(s.id)).sort((a, b) => b.date.localeCompare(a.date))[0];
};

export const daysUntil = (date: string, today = localToday()) =>
  Math.round((new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000);

export const shortDay = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const fmtPct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}%`;

// ---------- The team goal ----------

export const goalLine = (goal: TeamGoal, group: PositionGroup) => STANDARDS[group][goal.test][goal.level];

export const goalByLabel = (by: string) =>
  new Date(by + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

const testName = (test: StandardTest) => TESTS.find(t => t.key === test)!.label;
export const goalTier = (goal: TeamGoal) => (goal.level === 0 ? LEVELS[0] : `${LEVELS[goal.level]} or better`);

// "Every player at Bronze on the Bronco by Jan 4", "20 Varsity players at Silver or better on the 10 m by Jan 17"
export const goalSentence = (goal: TeamGoal) => {
  const squad = goal.squad === 'All' ? '' : `${goal.squad} `;
  const who = goal.count ? `${goal.count} ${squad}player${goal.count === 1 ? '' : 's'}` : `Every ${squad}player`;
  return `${who} at ${goalTier(goal)} on the ${testName(goal.test)} by ${goalByLabel(goal.by)}`;
};
