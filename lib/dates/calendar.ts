// Calendar-date maths for the date picker (GCO-002, GCO-004): "YYYY-MM-DD" strings in, strings out.
// WHY no time zones: these are calendar dates, not instants. Everything runs on UTC fields so a
// viewer's zone or daylight saving can never move a day.

const DAY_MS = 86_400_000;

export type YmdParts = { year: number; month: number; day: number };

export function parseYmdParts(ymd: string): YmdParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? { year, month, day } : null;
}

export function toYmd({ year, month, day }: YmdParts): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday is 0 and Sunday is 6: weeks start on Monday (owner assumption, date-picker task). */
export function weekdayIndex(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

export function addDays(ymd: string, days: number): string {
  const p = parseYmdParts(ymd);
  if (!p) return ymd;
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day) + days * DAY_MS);
  return toYmd({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
}

// WHY clamp: 31 Jan + 1 month is 28 or 29 Feb, not 3 March.
export function addMonths(ymd: string, months: number): string {
  const p = parseYmdParts(ymd);
  if (!p) return ymd;
  const index = p.year * 12 + (p.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return toYmd({ year, month, day: Math.min(p.day, daysInMonth(year, month)) });
}

export function startOfWeek(ymd: string): string {
  const p = parseYmdParts(ymd);
  return p ? addDays(ymd, -weekdayIndex(p.year, p.month, p.day)) : ymd;
}

export function endOfWeek(ymd: string): string {
  return addDays(startOfWeek(ymd), 6);
}

/** Weeks of a month, Monday first. Days of the neighbouring months are null (shown as empty cells). */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const lead = weekdayIndex(year, month, 1);
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth(year, month); day += 1) cells.push(toYmd({ year, month, day }));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// The viewer's own calendar day (local fields, not UTC).
export function localTodayYmd(now: Date = new Date()): string {
  return toYmd({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}

function utcNames(options: Intl.DateTimeFormatOptions, date: Date): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
}

/** "Mon" ... "Sun", Monday first, with the full name for the accessible label. */
export function weekdayHeaders(): { short: string; long: string }[] {
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 1 + i));
    return { short: utcNames({ weekday: "short" }, date), long: utcNames({ weekday: "long" }, date) };
  });
}

/** "December 2026". */
export function formatMonthYear(year: number, month: number): string {
  return `${utcNames({ month: "long" }, new Date(Date.UTC(year, month - 1, 1)))} ${year}`;
}

/** "Friday 4 December 2026": the accessible name of a day. Null when it is not a date. */
export function formatYmdLongFull(ymd: string): string | null {
  const p = parseYmdParts(ymd);
  if (!p) return null;
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return `${utcNames({ weekday: "long" }, date)} ${p.day} ${utcNames({ month: "long" }, date)} ${p.year}`;
}
