// "Saturday 31 October": the date line on Home (HomeState-first). The zone is the viewer's own
// (product rules); the caller passes it, so this stays a pure function.
export function formatLongDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  // WHY not format(): the comma after the weekday depends on the ICU version, the board has none.
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}
