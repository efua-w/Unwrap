import type { NotificationKey } from "./notifications";

// UI copy for Notifications (S44, GC-026). Sources: boards Acc-Notif-default, -saving, -off, -error, -offline
// (m and d), and owner decisions Q2 and Q11 (2026-11-17). Lines marked "pending" are not on a board and are
// listed in docs/copy-pending.md.
export const NOTIFICATION_COPY = {
  title: "Notifications",
  subtitle: "Changes save as you make them. We only send email for now.",
  groupLegend: "Emails you can turn off",
  options: {
    namesDrawn: {
      label: "Names are drawn",
      hint: "Find out who you're buying for. Also sent if names are drawn again or your person changes.",
    },
    someoneJoins: { label: "Someone joins", hint: "Only for exchanges you organise." },
  },
  alwaysTitle: "Always sent",
  // pending: the board lists emails for a cancelled exchange and a new organiser, which are not built yet.
  alwaysBody: "You can't turn these off: you were removed from an exchange, and sign-in codes.",
  loadError: "We couldn't load your notification settings.",
} as const satisfies Record<string, unknown>;

type Label = (typeof NOTIFICATION_COPY.options)[NotificationKey]["label"];
const label = (key: NotificationKey): Label => NOTIFICATION_COPY.options[key].label;

// Board Acc-Notif-off: "Saved. You won't get Someone joins emails."
export const savedOff = (key: NotificationKey) => `Saved. You won't get ${label(key)} emails.`;
// pending: no board shows turning one back on.
export const savedOn = (key: NotificationKey) => `Saved. You'll get ${label(key)} emails.`;
// Board Acc-Notif-error: "We couldn't turn off Someone joins, so it's still on. Try again."
export const failedOff = (key: NotificationKey) => `We couldn't turn off ${label(key)}, so it's still on. Try again.`;
// pending: the turn-on error.
export const failedOn = (key: NotificationKey) => `We couldn't turn on ${label(key)}, so it's still off. Try again.`;
