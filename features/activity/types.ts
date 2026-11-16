import type { ExchangeTint } from "@/components/ui/ExchangeTag";

// What the Activity screen may carry (GC-006 S09). WHY no user id and no pair field: an event names one
// person and one exchange only, and the type has no room for a giver or a recipient (AC-20).
export type ActivityKind = "member_joined" | "join_requested";

/** One event as get_my_activity returns it. `createdAt` stays the database's own string so a keyset
 *  cursor built from it keeps its microseconds. */
export type ActivityRow = {
  id: string;
  kind: ActivityKind;
  exchangeId: string;
  exchangeName: string;
  exchangeTint: ExchangeTint;
  subjectName: string;
  createdAt: string;
  isUnread: boolean;
};

/** A row ready to show, with its day and time already in the viewer's zone. */
export type ActivityItem = {
  id: string;
  exchangeId: string;
  exchangeName: string;
  exchangeTint: ExchangeTint;
  title: string;
  sub: string;
  isUnread: boolean;
  /** "2026-11-15" in the viewer's zone: rows with the same key share one day group. */
  dayKey: string;
  /** "Today", "Yesterday" or "Thu 29 Oct". */
  dayLabel: string;
};

export type ActivityDay = { key: string; label: string; items: ActivityItem[] };

/** Where the next older page starts: the last row shown (keyset, never an offset). */
export type ActivityCursor = { beforeAt: string; beforeId: string };

export type ActivityPage = { items: ActivityItem[]; cursor: ActivityCursor | null };
