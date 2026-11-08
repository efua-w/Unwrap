// The "updated {date}" part of a wishlist row (GC-018). Owner rule 2026-11-05 (Q5): "today",
// "yesterday", "N days ago" up to 6 days, then "Wed 9 Sep", with the year only when it is not this
// year. Days are calendar days in the viewer's own zone (product rules), passed in by the caller so
// this stays a pure function.

const MS_PER_DAY = 86_400_000;

type DayParts = { year: number; month: number; day: number; weekday: string; monthName: string };

// WHY en-US for the names: recent ICU versions abbreviate September as "Sept" in en-GB, and the
// board says "Sep". Only the short names come from it; the order is built below.
function partsIn(date: Date, timeZone: string): DayParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const named = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    weekday: part("weekday"),
    monthName: named,
  };
}

// Whole calendar days between two dates in the viewer's zone (0 = same day).
function calendarDaysBetween(earlier: DayParts, later: DayParts): number {
  const a = Date.UTC(earlier.year, earlier.month - 1, earlier.day);
  const b = Date.UTC(later.year, later.month - 1, later.day);
  return Math.round((b - a) / MS_PER_DAY);
}

export function formatUpdated(updated: Date, now: Date, timeZone: string): string {
  const then = partsIn(updated, timeZone);
  const today = partsIn(now, timeZone);
  const days = calendarDaysBetween(then, today);
  // WHY <= 0 is "today": a clock slightly ahead on the server must never show a future date.
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 6) return `${days} days ago`;
  // WHY built from parts: the board has no comma ("Wed 9 Sep"), which format() adds on some ICU versions.
  const base = `${then.weekday} ${then.day} ${then.monthName}`;
  return then.year === today.year ? base : `${base} ${then.year}`;
}
