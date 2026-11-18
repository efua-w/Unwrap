// GC-026 Notifications. Two emails can be turned off in v1; the Join-by and Event reminder columns exist but
// stay hidden until slice 12 (owner Q2, 2026-11-17). WHY a key and not a column name from the browser: the
// action maps the key to a column itself.
export const NOTIFICATION_KEYS = ["namesDrawn", "someoneJoins"] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

export type NotificationSettings = Record<NotificationKey, boolean>;

export function isNotificationKey(value: unknown): value is NotificationKey {
  return typeof value === "string" && (NOTIFICATION_KEYS as readonly string[]).includes(value);
}
