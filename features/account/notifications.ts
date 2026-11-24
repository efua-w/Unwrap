// GC-026 Notifications. Four emails can be turned off: the two from slice 7 and, since slice 12, the Join-by and Event
// reminders. WHY a key and not a column name from the browser: the action maps the key to a column itself.
export const NOTIFICATION_KEYS = ["namesDrawn", "someoneJoins", "joinByReminder", "eventReminder"] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

export type NotificationSettings = Record<NotificationKey, boolean>;

export function isNotificationKey(value: unknown): value is NotificationKey {
  return typeof value === "string" && (NOTIFICATION_KEYS as readonly string[]).includes(value);
}
