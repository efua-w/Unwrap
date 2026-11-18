// Dates in an email, written to match the boards ("Fri 27 Nov, 6:00 pm WAT", "Thu 24 Dec").
// WHY a copy of the app's lib/dates/format.ts rules and not an import: the function is bundled on its own, so it
// reaches nothing outside supabase/functions. A unit test pins the two to the same output.
// Every moment is shown in the recipient's own zone with its label (product rule); the invitee with no account
// gets the organiser's zone from the sender's claim (owner Q9).

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

// WHY a fallback: a zone name the runtime does not know must not stop an email going out.
function knownZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

function day(date: Date, timeZone: string): string {
  const p = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", day: "numeric", month: "short" }).formatToParts(date);
  return `${part(p, "weekday")} ${part(p, "day")} ${part(p, "month")}`;
}

function time(date: Date, timeZone: string): string {
  const p = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(date);
  return `${part(p, "hour")}:${part(p, "minute")} ${part(p, "dayPeriod").toLowerCase()}`;
}

// WHY en-NG: it is the locale whose data names Lagos "WAT"; others print "GMT+1". Zones without a short name
// print GMT plus or minus the offset.
function zoneLabel(date: Date, timeZone: string): string {
  const p = new Intl.DateTimeFormat("en-NG", { timeZone, timeZoneName: "short" }).formatToParts(date);
  return part(p, "timeZoneName") || timeZone;
}

/** "Fri 27 Nov, 6:00 pm WAT" for an ISO moment, in the given zone. Null when the moment is not a date. */
export function formatMoment(iso: string, timeZone: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const zone = knownZone(timeZone);
  return `${day(date, zone)}, ${time(date, zone)} ${zoneLabel(date, zone)}`;
}

/** "Thu 24 Dec" for a stored calendar date ("2026-12-24"). WHY no zone: the gift day is the same date for everyone. */
export function formatGiftDay(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  if (Number.isNaN(date.getTime())) return null;
  return day(date, "UTC");
}

// Mirrors lib/money/budget.ts (BUDGET_PRESETS and budgetLabel); a unit test checks they agree.
const BUDGET_LABELS: Record<string, string> = {
  "5k_10k": "₦5,000 to ₦10,000",
  "10k_20k": "₦10,000 to ₦20,000",
  "20k_50k": "₦20,000 to ₦50,000",
  "50k_plus": "Above ₦50,000",
};

export function budgetText(preset: string): string | null {
  return BUDGET_LABELS[preset] ?? null;
}
