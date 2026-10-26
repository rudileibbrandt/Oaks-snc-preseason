// S&C standards: the Oaks Rugby Fitness Standards deck, as data.
//
// Four levels per test and position group. Each number is the line to reach:
// times at or under, jump and lifts at or over. Below Bronze = not reached Bronze yet.
// Elite is the top band ("Good") of USA Rugby's men's physical standards, per position
// (Drive: "USA Rugby Physical Standards – Men (imperial)"; broad jump rounded down to the inch),
// except the Bronco: 15 s faster than that sheet, near the usual "elite" lines (backs under 4:30).
// For scale, Super Rugby's average is 4:57 for backs and 5:21 for forwards.
// Prop 40 m has no source value; 5.60 is our estimate. Until 2026-10-26 Elite was the sheet's
// Minimum line. Bronze, Silver and Gold are our own step-downs and did not change with it.
// Hookers and locks share every line except the squat, as the source does.
import { RugbyPosition, TestResult, TestSession } from '../types';
import { TESTING_SEASON_START } from './season';

export const LEVELS = ['Bronze', 'Silver', 'Gold', 'Elite'] as const;
export type Level = typeof LEVELS[number];

export type StandardTest = 'bronco' | 'sprint10' | 'sprint40' | 'broadJump' | 'chinup' | 'squat3rm';

export interface TestDef {
  key: StandardTest;
  label: string;
  unit: string; // shown after numbers
  lowerIsBetter: boolean;
  how: string;
}

export const TESTS: TestDef[] = [
  { key: 'bronco', label: 'Bronco', unit: '', lowerIsBetter: true,
    how: 'Shuttles to 20 m, 40 m and 60 m and back is one set. Run 5 sets (1,200 m) without stopping. 1 attempt.' },
  { key: 'sprint10', label: '10 m', unit: 's', lowerIsBetter: true,
    how: 'Start still, front foot on the line. One sprint gives the 10 m and 40 m times. Best of 3.' },
  { key: 'sprint40', label: '40 m', unit: 's', lowerIsBetter: true,
    how: 'Same sprint as the 10 m. Best of 3.' },
  { key: 'broadJump', label: 'Broad jump', unit: 'in', lowerIsBetter: false,
    how: 'Two-foot take-off, land on both feet. Measure to the back of the nearest heel. Best of 3.' },
  { key: 'chinup', label: 'Chin-up total', unit: 'lb', lowerIsBetter: false,
    how: 'Palms facing you, dead hang to chin over the bar. Score = bodyweight + weight added. Best of 2.' },
  { key: 'squat3rm', label: 'Squat 3RM', unit: 'lb', lowerIsBetter: false,
    how: 'Heaviest weight for 3 clean reps, thighs at least parallel, coach watching. Only once a coach has signed off technique.' },
];

export type PositionGroup = 'props' | 'hookers' | 'locks' | 'backrow' | 'scrumhalves' | 'flyhalves' | 'centers' | 'backthree';

export const GROUPS: { key: PositionGroup; label: string; positions: RugbyPosition[] }[] = [
  { key: 'props', label: 'Props · 1 and 3', positions: [1, 3] },
  { key: 'hookers', label: 'Hookers · 2', positions: [2] },
  { key: 'locks', label: 'Locks · 4 and 5', positions: [4, 5] },
  { key: 'backrow', label: 'Back row · 6, 7 and 8', positions: [6, 7, 8] },
  { key: 'scrumhalves', label: 'Scrumhalves · 9', positions: [9] },
  { key: 'flyhalves', label: 'Flyhalves · 10', positions: [10] },
  { key: 'centers', label: 'Centers · 12 and 13', positions: [12, 13] },
  { key: 'backthree', label: 'Back three · 11, 14 and 15', positions: [11, 14, 15] },
];

export const groupLabel = (g: PositionGroup) => GROUPS.find(x => x.key === g)?.label ?? g;
export const groupForPosition = (pos?: RugbyPosition): PositionGroup | undefined =>
  pos ? GROUPS.find(g => g.positions.includes(pos))?.key : undefined;

// Bronze, Silver, Gold, Elite. Bronco in seconds.
type Row = [number, number, number, number];
const t = (s: string) => parseBronco(s)!;
const bronco = (a: string, b: string, c: string, d: string): Row => [t(a), t(b), t(c), t(d)];

export const STANDARDS: Record<PositionGroup, Record<StandardTest, Row>> = {
  props: {
    bronco: bronco('6:14', '5:57', '5:47', '5:05'), sprint10: [1.96, 1.91, 1.87, 1.75], sprint40: [6.32, 6.08, 5.97, 5.60],
    broadJump: [83, 88, 91, 100], chinup: [215, 255, 280, 330], squat3rm: [220, 285, 335, 420],
  },
  hookers: {
    bronco: bronco('6:03', '5:46', '5:37', '4:55'), sprint10: [1.91, 1.85, 1.82, 1.70], sprint40: [5.83, 5.62, 5.51, 5.20],
    broadJump: [88, 94, 97, 104], chinup: [200, 240, 260, 310], squat3rm: [210, 270, 315, 400],
  },
  locks: {
    bronco: bronco('6:03', '5:46', '5:37', '4:55'), sprint10: [1.91, 1.85, 1.82, 1.70], sprint40: [5.83, 5.62, 5.51, 5.20],
    broadJump: [88, 94, 97, 104], chinup: [200, 240, 260, 310], squat3rm: [185, 240, 280, 360],
  },
  backrow: {
    bronco: bronco('5:41', '5:26', '5:16', '4:35'), sprint10: [1.80, 1.75, 1.72, 1.60], sprint40: [5.72, 5.51, 5.41, 5.10],
    broadJump: [92, 98, 101, 110], chinup: [200, 240, 260, 310], squat3rm: [195, 255, 300, 380],
  },
  scrumhalves: {
    bronco: bronco('5:24', '5:10', '5:01', '4:30'), sprint10: [1.80, 1.75, 1.72, 1.60], sprint40: [5.56, 5.36, 5.25, 4.95],
    broadJump: [92, 98, 101, 110], chinup: [180, 210, 230, 280], squat3rm: [170, 220, 255, 330],
  },
  flyhalves: {
    bronco: bronco('5:24', '5:10', '5:01', '4:30'), sprint10: [1.80, 1.75, 1.72, 1.60], sprint40: [5.56, 5.36, 5.25, 4.95],
    broadJump: [92, 98, 101, 110], chinup: [185, 220, 240, 290], squat3rm: [175, 225, 265, 340],
  },
  centers: {
    bronco: bronco('5:30', '5:15', '5:06', '4:35'), sprint10: [1.80, 1.75, 1.72, 1.60], sprint40: [5.51, 5.30, 5.20, 4.90],
    broadJump: [92, 98, 101, 110], chinup: [195, 230, 250, 300], squat3rm: [185, 240, 280, 360],
  },
  backthree: {
    bronco: bronco('5:24', '5:10', '5:01', '4:30'), sprint10: [1.80, 1.75, 1.72, 1.60], sprint40: [5.51, 5.30, 5.20, 4.90],
    broadJump: [92, 98, 101, 110], chinup: [185, 220, 240, 290], squat3rm: [175, 225, 265, 340],
  },
};

// ---------- Numbers in and out ----------

// "5:24" or "324" (seconds) → 324. Anything else → undefined.
export function parseBronco(s: string): number | undefined {
  const v = s.trim();
  const m = v.match(/^(\d{1,2}):([0-5]\d(?:\.\d+)?)$/);
  if (m) return parseInt(m[1]) * 60 + parseFloat(m[2]);
  return parsePositive(v);
}

export function parsePositive(s: string): number | undefined {
  const n = parseFloat(s.trim());
  return /^\d+(\.\d+)?$/.test(s.trim()) && n > 0 ? n : undefined;
}

export const formatBronco = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatValue = (test: StandardTest, v: number) => {
  if (test === 'bronco') return formatBronco(v);
  if (test === 'sprint10' || test === 'sprint40') return `${v.toFixed(2)}s`;
  return `${Math.round(v * 10) / 10} ${TESTS.find(x => x.key === test)!.unit}`;
};

// The number shown in a standards table cell (no unit).
export const formatStandard = (test: StandardTest, v: number) =>
  test === 'bronco' ? formatBronco(v) : test === 'sprint10' || test === 'sprint40' ? v.toFixed(2) : String(v);

// ---------- Levels ----------

const reached = (test: StandardTest, value: number, line: number) =>
  TESTS.find(x => x.key === test)!.lowerIsBetter ? value <= line + 1e-9 : value >= line - 1e-9;

// Index of the highest level reached (0 Bronze … 3 Elite), or -1 for below Bronze.
export const levelIndex = (group: PositionGroup, test: StandardTest, value: number) => {
  const row = STANDARDS[group][test];
  let idx = -1;
  row.forEach((line, i) => { if (reached(test, value, line)) idx = i; });
  return idx;
};

export const levelName = (idx: number) => (idx < 0 ? 'Below Bronze' : LEVELS[idx]);

// The next line to reach and how far away it is; undefined at Elite.
export const nextLevel = (group: PositionGroup, test: StandardTest, value: number) => {
  const idx = levelIndex(group, test, value);
  if (idx >= 3) return undefined;
  const line = STANDARDS[group][test][idx + 1];
  return { level: LEVELS[idx + 1], line, gap: Math.abs(value - line) };
};

export const formatGap = (test: StandardTest, gap: number) =>
  test === 'bronco' ? `${Math.ceil(gap)}s` : test === 'sprint10' || test === 'sprint40' ? `${gap.toFixed(2)}s`
    : `${Math.ceil(gap)} ${TESTS.find(x => x.key === test)!.unit}`;

// ---------- Results ----------

// A result's score on one test. Chin-up total = bodyweight + added (needs both).
export const scoreOf = (r: TestResult, test: StandardTest): number | undefined => {
  if (test === 'chinup') {
    if (r.bodyweight == null || r.chinupAdded == null) return undefined;
    return r.bodyweight + r.chinupAdded;
  }
  const v = r[test];
  return v == null ? undefined : v;
};

export interface BestScore {
  value: number;
  sessionId: string;
  date: string;
}

// A player's best score per test, this season only (sessions dated on or after TESTING_SEASON_START).
export const bestThisSeason = (results: TestResult[], sessions: TestSession[], seasonStart = TESTING_SEASON_START) => {
  const dateOf = new Map(sessions.map(s => [s.id, s.date]));
  const best: Partial<Record<StandardTest, BestScore>> = {};
  for (const r of results) {
    const date = dateOf.get(r.sessionId);
    if (!date || date < seasonStart) continue;
    for (const test of TESTS) {
      const v = scoreOf(r, test.key);
      if (v === undefined) continue;
      const cur = best[test.key];
      if (!cur || (test.lowerIsBetter ? v < cur.value : v > cur.value)) best[test.key] = { value: v, sessionId: r.sessionId, date };
    }
  }
  return best;
};

export interface TestSummary {
  list: BestScore[]; // every result this season, oldest first; missed tests are left out
  best: BestScore;   // sets the tier
  worst: BestScore;
  latest: BestScore;
  first: BestScore;
}

// One test's results this season: best, worst, latest, first and all of them. Ties go to the earliest.
export const testSummary = (
  results: TestResult[], sessions: TestSession[], test: StandardTest, seasonStart = TESTING_SEASON_START,
): TestSummary | undefined => {
  const lower = TESTS.find(x => x.key === test)!.lowerIsBetter;
  const dateOf = new Map(sessions.map(s => [s.id, s.date]));
  const list: BestScore[] = [];
  for (const r of results) {
    const date = dateOf.get(r.sessionId);
    const value = scoreOf(r, test);
    if (!date || date < seasonStart || value === undefined) continue;
    list.push({ value, sessionId: r.sessionId, date });
  }
  if (list.length === 0) return undefined;
  list.sort((a, b) => a.date.localeCompare(b.date));
  const isBetter = (a: number, b: number) => (lower ? a < b : a > b);
  let best = list[0], worst = list[0];
  for (const x of list) {
    if (isBetter(x.value, best.value)) best = x;
    if (isBetter(worst.value, x.value)) worst = x;
  }
  return { list, best, worst, latest: list[list.length - 1], first: list[0] };
};

// Latest compared with the first result this season; undefined with only one result.
export const progressOf = (s: TestSummary, test: StandardTest) => {
  if (s.list.length < 2) return undefined;
  const lower = TESTS.find(x => x.key === test)!.lowerIsBetter;
  const diff = s.latest.value - s.first.value;
  const amount = Math.round(Math.abs(diff) * 100) / 100;
  return { improved: amount > 0 && (lower ? diff < 0 : diff > 0), amount, since: s.first.sessionId };
};

export const formatProgress = (test: StandardTest, p: { improved: boolean; amount: number }) => {
  if (p.amount === 0) return 'no change';
  if (test === 'bronco') return `${Math.round(p.amount)}s ${p.improved ? 'faster' : 'slower'}`;
  if (test === 'sprint10' || test === 'sprint40') return `${p.amount.toFixed(2)}s ${p.improved ? 'faster' : 'slower'}`;
  return `${Math.round(p.amount)} ${TESTS.find(x => x.key === test)!.unit} ${p.improved ? 'more' : 'less'}`;
};

// The position group a player is tested in: their latest result's group, else their best position.
export const playerGroup = (results: TestResult[], sessions: TestSession[], bestPosition?: RugbyPosition) => {
  const dateOf = new Map(sessions.map(s => [s.id, s.date]));
  const latest = [...results].sort((a, b) => (dateOf.get(b.sessionId) ?? '').localeCompare(dateOf.get(a.sessionId) ?? ''))[0];
  return latest?.group ?? groupForPosition(bestPosition);
};
