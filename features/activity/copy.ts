// UI copy for Activity (S09, GC-006 / GCO-003). Sources: boards Activity-* (canvas "Unwrap", m and d) and
// the owner decisions of 2026-11-14 (docs/tasks/slice-6.md, Q12). "Choose which emails you get" came with
// slice 7 (it links to Notifications). Lines marked "pending" are not on a board and are listed in docs/copy-pending.md.

export const ACTIVITY_COPY = {
  title: "Activity",
  unread: (n: number) => `${n} unread`,
  noneUnread: "No unread activity",
  markAll: "Mark all as read",
  today: "Today",
  yesterday: "Yesterday",
  joined: (name: string, exchange: string) => `${name} joined ${exchange}.`,
  asked: (name: string, exchange: string) => `${name} asked to join ${exchange}.`,
  askedSub: (time: string) => `${time} · Approve or decline`,
  // Board Activity-default (GC-007): the Names drawn event links to Reveal.
  drawn: (exchange: string) => `Names are drawn for ${exchange}.`,
  drawnSub: (time: string) => `${time} · See who you're buying for`,
  // pending (docs/copy-pending.md, slice 12, Q12): no board draws these three rows; the spec text only lists the kinds.
  joinByReminder: (exchange: string) => `Joining closes soon for ${exchange}.`,
  joinByReminderSub: (time: string) => `${time} · Add your wishlist`,
  eventReminder: (exchange: string) => `${exchange} is tomorrow.`,
  eventReminderSub: (time: string) => `${time} · Get your gift ready`,
  completed: (exchange: string) => `${exchange} is complete.`,
  chooseEmails: "Choose which emails you get",
  older: "Load older activity",
  olderBusy: "Loading older activity",
  emptyTitle: "You're all caught up.",
  emptyBody: "When something happens in your exchanges, it'll show here.",
  loadError: "We couldn't load your activity. Nothing you've done is lost.",
  // pending: no board shows a failed Mark all as read or a failed Load older.
  markFailed: "We couldn't mark your activity as read. Try again.",
  olderFailed: "We couldn't load older activity. Try again.",
  // WHY visually hidden: the dot beside an unread row says it in words for people who can't see it.
  unreadMarker: "Unread",
} as const;
