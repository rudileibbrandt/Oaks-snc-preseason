// Improvement across tests in different units (seconds, inches, pounds), for the Me and Team tabs.
// No runtime imports, so Node's test runner can load it directly.
//
// How it's measured (Rudi, 22 Nov 2026: the Bronco is the goal, the rest we measure for improvement):
// - Each test's change is a %: first result this season vs latest. Faster times and bigger numbers
//   are both +, so tests in different units can be averaged. One result = no change yet.
// - A player's overall = the average of their tests with two or more results.
// - The team figure = the median player, so one big jump (or a bad day) can't swing it.
// - A PR on a testing day = better than every earlier result this season. A first test isn't a PR.

export type Series = { date: string; value: number }[]; // one test's results this season, oldest first
export type LowerIsBetter = Record<string, boolean>;

const round2 = (x: number) => Math.round(x * 100) / 100;

export const pctChange = (first: number, latest: number, lowerIsBetter: boolean) =>
  round2(((lowerIsBetter ? first - latest : latest - first) / first) * 100);

export const median = (xs: number[]): number | undefined => {
  if (xs.length === 0) return undefined;
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};

const sorted = (s: Series) => [...s].sort((a, b) => a.date.localeCompare(b.date));

export interface PlayerImprovement {
  perTest: Record<string, number | undefined>;
  overall: number | undefined;
}

export const playerImprovement = (series: Record<string, Series | undefined>, lower: LowerIsBetter): PlayerImprovement => {
  const perTest: Record<string, number | undefined> = {};
  for (const [test, raw] of Object.entries(series)) {
    if (!raw || raw.length < 2) { perTest[test] = undefined; continue; }
    const s = sorted(raw);
    perTest[test] = pctChange(s[0].value, s[s.length - 1].value, !!lower[test]);
  }
  const vals = Object.values(perTest).filter((v): v is number => v !== undefined);
  return { perTest, overall: vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : undefined };
};

export interface TeamImprovement {
  perTest: Record<string, { median: number; n: number } | undefined>;
  overall: { median: number; n: number } | undefined;
}

export const teamImprovement = (players: PlayerImprovement[], tests: string[]): TeamImprovement => {
  const stat = (xs: number[]) => (xs.length ? { median: median(xs)!, n: xs.length } : undefined);
  const perTest: TeamImprovement['perTest'] = {};
  for (const t of tests) {
    perTest[t] = stat(players.map(p => p.perTest[t]).filter((v): v is number => v !== undefined));
  }
  return { perTest, overall: stat(players.map(p => p.overall).filter((v): v is number => v !== undefined)) };
};

// PRs set on one testing day. comparable = players tested that day who had an earlier result on a
// test they did that day (so a PR was possible); comparableResults = those results, one per player
// per test; prCount = how many of them were PRs. The Team tab shows prCount / comparableResults.
export const sessionPRs = (
  players: { name: string; series: Record<string, Series | undefined> }[], day: string, lower: LowerIsBetter,
) => {
  const prPlayers: string[] = [];
  let comparable = 0, prCount = 0, comparableResults = 0;
  for (const p of players) {
    let canPR = false, pr = false;
    for (const [test, s] of Object.entries(p.series)) {
      if (!s) continue;
      const today = s.filter(x => x.date === day);
      const earlier = s.filter(x => x.date < day);
      if (today.length === 0 || earlier.length === 0) continue;
      canPR = true;
      comparableResults++;
      const better = (a: number, b: number) => (lower[test] ? a < b : a > b);
      const todayBest = today.reduce((a, b) => (better(b.value, a.value) ? b : a)).value;
      if (earlier.every(x => better(todayBest, x.value))) { pr = true; prCount++; }
    }
    if (canPR) comparable++;
    if (pr) prPlayers.push(p.name);
  }
  return { prPlayers, comparable, prCount, comparableResults };
};

// The team goal: players reaching a tier's line on one test (Rudi, 22 Nov 2026: every player at
// Bronze on the Bronco by 4 Jan). best = the player's best this season; line = the tier's line for
// their position group. count = how many players must reach it (none = every player).
export const goalProgress = (
  players: { name: string; best: number | undefined; line: number }[],
  opts: { lowerIsBetter: boolean; reach: number; count?: number | null },
) => {
  const short: { name: string; best: number; gap: number }[] = [];
  const notRun: string[] = [];
  let counted = 0;
  for (const p of players) {
    if (p.best === undefined) notRun.push(p.name);
    else if (opts.lowerIsBetter ? p.best <= p.line + 1e-9 : p.best >= p.line - 1e-9) counted++;
    else short.push({ name: p.name, best: p.best, gap: round2(Math.abs(p.best - p.line)) });
  }
  short.sort((a, b) => a.gap - b.gap || a.name.localeCompare(b.name));
  const target = opts.count ? Math.min(opts.count, players.length) : players.length;
  return {
    counted, total: players.length, target, met: counted >= target,
    short, withinReach: short.filter(x => x.gap <= opts.reach).length, notRun,
  };
};

// Fun totals: seconds off the team's Bronco and pounds added to the team's squat, first vs latest,
// counting only players with two or more results on that test.
export const teamTotals = (players: Record<string, Series | undefined>[]) => {
  let broncoSecondsOff = 0, squatLbAdded = 0;
  for (const p of players) {
    const b = p.bronco && p.bronco.length >= 2 ? sorted(p.bronco) : undefined;
    if (b) broncoSecondsOff += b[0].value - b[b.length - 1].value;
    const q = p.squat3rm && p.squat3rm.length >= 2 ? sorted(p.squat3rm) : undefined;
    if (q) squatLbAdded += q[q.length - 1].value - q[0].value;
  }
  return { broncoSecondsOff: round2(broncoSecondsOff), squatLbAdded: round2(squatLbAdded) };
};
