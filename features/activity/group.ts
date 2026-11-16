import { formatDay, formatTime, nextYmd, wallClockIn } from "@/lib/dates/format";
import { firstName } from "@/features/shared-wishlist/copy";
import { ACTIVITY_COPY } from "./copy";
import type { ActivityDay, ActivityItem, ActivityRow } from "./types";

// Day groups in the viewer's own zone (product rules; AC-22, AC-36). WHY the day is decided from wall-clock
// dates in the zone and never by dividing hours: a day is 23 or 25 hours long at a clock change, and an
// event at 23:30 in Lagos is already tomorrow in Auckland.

/** "Today", "Yesterday", or "Thu 29 Oct" for the day `at` falls on in `timeZone`. */
export function dayLabel(at: Date, now: Date, timeZone: string): string {
  const day = wallClockIn(at, timeZone).ymd;
  const today = wallClockIn(now, timeZone).ymd;
  if (day === today) return ACTIVITY_COPY.today;
  if (nextYmd(day) === today) return ACTIVITY_COPY.yesterday;
  return formatDay(at, timeZone);
}

/** "{Name} joined {exchange}." or "{Name} asked to join {exchange}.", with the time as the second line. */
export function toActivityItem(row: ActivityRow, now: Date, timeZone: string): ActivityItem {
  const at = new Date(row.createdAt);
  const name = firstName(row.subjectName);
  const time = formatTime(at, timeZone);
  const asked = row.kind === "join_requested";
  return {
    id: row.id,
    exchangeId: row.exchangeId,
    exchangeName: row.exchangeName,
    exchangeTint: row.exchangeTint,
    title: asked ? ACTIVITY_COPY.asked(name, row.exchangeName) : ACTIVITY_COPY.joined(name, row.exchangeName),
    sub: asked ? ACTIVITY_COPY.askedSub(time) : time,
    isUnread: row.isUnread,
    dayKey: wallClockIn(at, timeZone).ymd,
    dayLabel: dayLabel(at, now, timeZone),
  };
}

/** Consecutive rows with the same day share a group; the database already returns newest first. */
export function groupByDay(items: readonly ActivityItem[]): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const item of items) {
    const last = days[days.length - 1];
    if (last && last.key === item.dayKey) last.items.push(item);
    else days.push({ key: item.dayKey, label: item.dayLabel, items: [item] });
  }
  return days;
}
