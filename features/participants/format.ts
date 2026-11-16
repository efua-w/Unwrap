import { formatDay, formatTime } from "@/lib/dates/format";
import { joinedToday } from "@/features/exchanges/people";
import { firstName } from "@/features/joining/copy";
import { PARTICIPANTS_COPY } from "./copy";

// Pure helpers for Participants and the request blocks (GCO-007, GCO-006).

// "Asked today at 8:12 am" or "Asked Thu 29 Oct, 8:12 am", in the viewer's own zone (product rules).
export function askedLabel(requestedAt: string, now: Date, timeZone: string): string {
  const at = new Date(requestedAt);
  const time = formatTime(at, timeZone);
  // WHY joinedToday: it is a same-calendar-day check in the zone, whatever the event is called.
  return joinedToday(requestedAt, now, timeZone)
    ? PARTICIPANTS_COPY.askedToday(time)
    : PARTICIPANTS_COPY.askedOn(formatDay(at, timeZone), time);
}

const NAMES_SHOWN = 3;

// "Chidi, Bisi and Femi", or "Chidi, Bisi, Femi and 2 others" past three. First names only (the story's
// "{A, B and C} are waiting"). Needs at least two names: a single request has its own sentence.
export function waitingNames(displayNames: readonly string[]): string {
  const first = displayNames.map(firstName);
  if (first.length <= NAMES_SHOWN) return joinAnd(first);
  const rest = first.length - NAMES_SHOWN;
  return `${first.slice(0, NAMES_SHOWN).join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

function joinAnd(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
