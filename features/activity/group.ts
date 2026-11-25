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

// The title and second line of a row, by kind. WHY a switch with no default: a new kind fails the type check here, so it cannot
// reach the screen with the wrong sentence.
function wording(row: ActivityRow, time: string): { title: string; sub: string } {
  const exchange = row.exchangeName;
  switch (row.kind) {
    case "names_drawn":
      return { title: ACTIVITY_COPY.drawn(exchange), sub: ACTIVITY_COPY.drawnSub(time) };
    case "join_requested":
      return { title: ACTIVITY_COPY.asked(firstName(row.subjectName), exchange), sub: ACTIVITY_COPY.askedSub(time) };
    case "member_joined":
      return { title: ACTIVITY_COPY.joined(firstName(row.subjectName), exchange), sub: time };
    case "join_by_reminder":
      return { title: ACTIVITY_COPY.joinByReminder(exchange), sub: ACTIVITY_COPY.joinByReminderSub(time) };
    case "event_reminder":
      return { title: ACTIVITY_COPY.eventReminder(exchange), sub: ACTIVITY_COPY.eventReminderSub(time) };
    case "exchange_completed":
      return { title: ACTIVITY_COPY.completed(exchange), sub: time };
  }
}

/** "{Name} joined {exchange}.", "{Name} asked to join {exchange}.", a draw, a reminder or a completion, with the time as the second line. */
export function toActivityItem(row: ActivityRow, now: Date, timeZone: string): ActivityItem {
  const at = new Date(row.createdAt);
  const { title, sub } = wording(row, formatTime(at, timeZone));
  return {
    id: row.id,
    exchangeId: row.exchangeId,
    exchangeName: row.exchangeName,
    exchangeTint: row.exchangeTint,
    title,
    sub,
    // WHY Reveal: the event is the prompt to see who you got (GC-007). Every person who gets it takes part, so they have an assignment.
    // WHY the exchange for the rest: reminders and a completion go to the exchange page (board spec, slice 12).
    href: row.kind === "names_drawn" ? `/exchanges/${row.exchangeId}/reveal` : `/exchanges/${row.exchangeId}`,
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
