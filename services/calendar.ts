// Date helpers for the team calendar. Dates are "YYYY-MM-DD" in local time.
import { WorkoutDay, WorkoutLog } from '../types';
import { ADVANCED_WEEKS } from './programData';
import { getISOWeek } from '../utils/weekUtils';

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// The dates shown for a month, whole weeks Monday to Sunday.
export const monthGrid = (year: number, month: number): string[] => {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7)); // back to Monday
  const last = new Date(year, month + 1, 0);
  const end = new Date(year, month, last.getDate() + ((7 - last.getDay()) % 7)); // on to Sunday
  const days: string[] = [];
  for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(isoDate(d));
  return days;
};

// The Advanced session planned for a date, with its week number.
export const advancedDayOn = (iso: string): { week: number; day: WorkoutDay } | undefined => {
  for (const w of ADVANCED_WEEKS) {
    const day = w.days.find(d => d.date === iso);
    if (day) return { week: w.week, day };
  }
  return undefined;
};

// Week of the block (1–7) a date falls in; both programs share these dates.
export const programWeekOn = (iso: string): number | undefined => {
  const w = ADVANCED_WEEKS.find(x => {
    const start = parseIso(x.startDate);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return iso >= x.startDate && iso <= isoDate(end);
  });
  return w?.week;
};

// "15:30" → "3:30 PM"
export const formatClock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// The date a workout was logged (when it was done), local time.
export const logDate = (log: WorkoutLog) => isoDate(new Date(log.timestamp));

// ISO week of a date, for counting a week's Intermediate sessions.
export const weekOfIso = (iso: string) => getISOWeek(parseIso(iso));
