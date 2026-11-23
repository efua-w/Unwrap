import type { ExchangeTint } from "@/components/ui/ExchangeTag";
import type { ActivityKind, ActivityRow } from "./types";

// Strict parser for get_my_activity rows (GC-006 S09). WHY exact keys: an event is a name, an exchange and a
// time. A row with an extra key (a user id, a counterpart) or a missing one is refused whole, so the page
// shows its error state instead of rendering something half-trusted (AC-19, AC-20).
const KEYS = ["id", "kind", "exchange_id", "exchange_name", "exchange_tint", "subject_name", "created_at", "is_unread"] as const;
const KINDS: readonly ActivityKind[] = ["member_joined", "join_requested", "names_drawn"];
const TINTS: readonly ExchangeTint[] = ["clay", "peach", "sand", "mint"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseRow(raw: unknown): ActivityRow | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).length !== KEYS.length || !KEYS.every((k) => Object.hasOwn(record, k))) return null;

  const { id, kind, exchange_id, exchange_name, exchange_tint, subject_name, created_at, is_unread } = record;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) return null;
  if (typeof exchange_id !== "string" || !UUID.test(exchange_id)) return null;
  if (typeof exchange_name !== "string" || exchange_name.trim() === "") return null;
  if (typeof exchange_tint !== "string" || !(TINTS as readonly string[]).includes(exchange_tint)) return null;
  // WHY null is allowed for names_drawn only: that event has no subject (the people kinds always do).
  if (kind === "names_drawn" ? subject_name !== null : typeof subject_name !== "string" || subject_name.trim() === "") return null;
  if (typeof created_at !== "string" || Number.isNaN(Date.parse(created_at))) return null;
  if (typeof is_unread !== "boolean") return null;
  return {
    id,
    kind: kind as ActivityKind,
    exchangeId: exchange_id,
    exchangeName: exchange_name,
    exchangeTint: exchange_tint as ExchangeTint,
    subjectName: typeof subject_name === "string" ? subject_name : "",
    createdAt: created_at,
    isUnread: is_unread,
  };
}

/** Null when the answer is not an array of well-formed rows. */
export function parseActivityRows(raw: unknown): ActivityRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: ActivityRow[] = [];
  for (const entry of raw) {
    const row = parseRow(entry);
    if (row === null) return null;
    rows.push(row);
  }
  return rows;
}

/** The unread count, or null for anything that is not a whole number of zero or more. */
export function parseUnreadCount(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw : null;
}
