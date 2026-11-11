import { formatDay, formatDayTime, formatTime } from "@/lib/dates/format";

type Props = {
  /** The instant, as stored (ISO string). */
  value: string;
  /** The viewer's own zone, passed by the page (readViewerTimeZone). */
  timeZone: string;
  /** "day": Fri 4 Dec. "time": 6:00 pm. "dayTime": Fri 4 Dec, 6:00 pm. */
  format?: "day" | "time" | "dayTime";
};

// A moment shown in the viewer's own zone (product rules). WHY a <time> element: the instant stays
// machine-readable while the visible text is the converted label. A Server Component, so the zone
// comes from the cookie and the HTML already holds the right day.
export function LocalDateTime({ value, timeZone, format = "day" }: Props) {
  const date = new Date(value);
  const text = format === "time" ? formatTime(date, timeZone) : format === "dayTime" ? formatDayTime(date, timeZone) : formatDay(date, timeZone);
  return <time dateTime={date.toISOString()}>{text}</time>;
}
