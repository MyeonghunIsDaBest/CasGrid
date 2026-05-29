import {
  addDays, format, isWeekend, startOfWeek, endOfWeek,
  isBefore, isAfter, parseISO, eachDayOfInterval, getDay,
  startOfDay, differenceInCalendarDays, isEqual
} from 'date-fns';

/** Returns working days (Mon-Fri) in a given date range, inclusive */
export function getWorkingDays(start: Date, end: Date): Date[] {
  if (isBefore(end, start)) return [];
  return eachDayOfInterval({ start, end }).filter(d => !isWeekend(d));
}

/** Returns working days for a given week offset from today */
export function getWeekWorkingDays(weekOffset: number = 0): Date[] {
  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  return getWorkingDays(weekStart, weekEnd);
}

/** Returns the start of the given week offset */
export function getWeekStart(weekOffset: number = 0): Date {
  const today = new Date();
  return startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
}

/** Formats a date as YYYY-MM-DD */
export function toDateString(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Parses a YYYY-MM-DD string to a Date */
export function fromDateString(s: string): Date {
  return parseISO(s);
}

/** Formats for display, e.g. "Mon 12 Jun" */
export function formatDay(d: Date): string {
  return format(d, 'EEE d MMM');
}

/** Returns short day name */
export function formatDayShort(d: Date): string {
  return format(d, 'EEE');
}

/** Returns date number */
export function formatDayNum(d: Date): string {
  return format(d, 'd');
}

/** Returns month/year e.g. "Jun 2025" */
export function formatMonthYear(d: Date): string {
  return format(d, 'MMM yyyy');
}

/** Australian numeric format, e.g. "15/06/2025" */
export function formatDateAU(d: Date): string {
  return format(d, 'dd/MM/yyyy');
}

export function isToday(d: Date): boolean {
  return toDateString(d) === toDateString(new Date());
}

export function isPast(d: Date): boolean {
  return isBefore(startOfDay(d), startOfDay(new Date()));
}

export function daysBetween(a: Date, b: Date): number {
  return differenceInCalendarDays(b, a);
}

export function datesEqual(a: Date, b: Date): boolean {
  return isEqual(startOfDay(a), startOfDay(b));
}

/** Returns working days between two dates that are in the future (>= today) */
export function getFutureWorkingDays(startDate: Date, endDate: Date): Date[] {
  const today = startOfDay(new Date());
  const from = isAfter(startDate, today) ? startDate : today;
  if (isAfter(from, endDate)) return [];
  return getWorkingDays(from, endDate);
}

export { format, addDays, isBefore, isAfter, parseISO, startOfDay };
