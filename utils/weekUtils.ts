// ISO 8601 Week Number Utilities
// ISO weeks start on Monday, week 1 is the first week with a Thursday

export interface WeekIdentifier {
  year: number;
  week: number; // ISO week number (1-53)
}

// Get ISO week number and year from a date
export function getISOWeek(date: Date): WeekIdentifier {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Convert Sunday (0) to 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Get Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return {
    year: d.getUTCFullYear(),
    week: weekNo
  };
}

// Get ISO week from timestamp
export function getISOWeekFromTimestamp(timestamp: number): WeekIdentifier {
  return getISOWeek(new Date(timestamp));
}

// Get the Monday (start) of an ISO week
export function getISOWeekStart(year: number, week: number): Date {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  return ISOweekStart;
}

// Get the Sunday (end) of an ISO week
export function getISOWeekEnd(year: number, week: number): Date {
  const start = getISOWeekStart(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

// Get current ISO week
export function getCurrentISOWeek(): WeekIdentifier {
  return getISOWeek(new Date());
}

// Format week identifier as string (e.g., "2024-W48")
export function formatWeekIdentifier(weekId: WeekIdentifier): string {
  return `${weekId.year}-W${weekId.week.toString().padStart(2, '0')}`;
}

// Parse week identifier from string (e.g., "2024-W48")
export function parseWeekIdentifier(weekString: string): WeekIdentifier | null {
  const match = weekString.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    week: parseInt(match[2], 10)
  };
}

// Compare two week identifiers (for sorting)
export function compareWeekIdentifiers(a: WeekIdentifier, b: WeekIdentifier): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.week - b.week;
}

