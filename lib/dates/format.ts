// Day and time labels for exchanges (GCO-002, GC-013): "Fri 4 Dec", "6:00 pm", "Fri 4 Dec, 6:00 pm".
// Pure: the caller passes the zone, so a server page uses the viewer's cookie zone and the Start
// exchange form uses the browser's (product rules: every moment shows in the viewer's own zone).

const DAY_ZONE_FREE = "UTC";

type Parts = { weekday: string; day: string; month: string };

// WHY en-US for the names: recent ICU versions abbreviate September as "Sept" in en-GB, and the
// boards say "Sep". The order ("Fri 4 Dec", no comma) is built here, not by format().
function dayParts(date: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: part("weekday"), day: part("day"), month: part("month") };
}

export function formatDay(date: Date, timeZone: string): string {
  const p = dayParts(date, timeZone);
  return `${p.weekday} ${p.day} ${p.month}`;
}

// "6:00 pm": lower-case, with a plain space (ICU may use a narrow no-break space before PM).
export function formatTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")} ${part("dayPeriod").toLowerCase()}`;
}

export function formatDayTime(date: Date, timeZone: string): string {
  return `${formatDay(date, timeZone)}, ${formatTime(date, timeZone)}`;
}

// The zone's short name for the "Times are in your time zone (WAT)" line. WHY en-NG: it is the
// locale whose data names Lagos "WAT"; others print "GMT+1". Zones without a short name print GMT±n.
export function zoneShortName(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-NG", { timeZone, timeZoneName: "short" }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

// A calendar date typed into the form ("2026-12-04"), with no instant and no zone: noon UTC keeps
// the weekday right in every zone. Returns null for anything that is not a real date.
export function parseYmd(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? date : null;
}

export function formatYmdDay(ymd: string): string | null {
  const date = parseYmd(ymd);
  return date ? formatDay(date, DAY_ZONE_FREE) : null;
}

// A time typed into the form ("18:00") as "6:00 pm". Null for anything that is not HH:MM.
export function formatHm(hm: string): string | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(hm);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const period = hour >= 12 ? "pm" : "am";
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${period}`;
}

// The hour (0-23) of a typed time, to choose "that evening" or "that day" in the summary (GCO-002).
export function hourOfHm(hm: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(hm);
  return match ? Number(match[1]) : null;
}

// "What time is it on the wall in this zone", as the strings the form compares: "2026-12-04" and
// "18:00". WHY strings: the organiser's dates and times are wall-clock values in their own zone, and
// a wall-clock comparison needs no zone arithmetic (the database makes the real instants).
export function wallClockIn(date: Date, timeZone: string): { ymd: string; hm: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { ymd: `${part("year")}-${part("month")}-${part("day")}`, hm: `${part("hour")}:${part("minute")}` };
}

// The calendar day after a typed one ("2026-12-04" -> "2026-12-05"), or null when it is not a date.
export function nextYmd(ymd: string): string | null {
  const date = parseYmd(ymd);
  if (!date) return null;
  return new Date(date.getTime() + 86_400_000).toISOString().slice(0, 10);
}
