import { isBudgetPreset } from "@/lib/money/budget";
import type { InvitePreview, InviteStatus, JoinDetails, JoinPerson, JoinViewer } from "./types";

// Strict parsers for the two jsonb payloads (GC-002, GC-009). WHY exact key sets, not "copy the known
// keys" like features/shared-wishlist/parse.ts: these payloads are the whole boundary between the
// database and pages a stranger may open. If the function ever grows a key (an id, the note on the
// public preview), the page treats the answer as unavailable instead of rendering it half-trusted.
// Anything unknown, missing or of the wrong type gives null.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((k) => Object.hasOwn(value, k));
}

const STATUSES: readonly InviteStatus[] = ["open", "closed", "cancelled", "full", "approval"];
const TINTS = ["clay", "peach", "sand", "mint"] as const;
const VIEWERS: readonly JoinViewer[] = ["member", "can_join", "removed"];
const DRAW_MODES = ["at_join_by", "organiser_chooses"] as const;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function isInstant(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function nullableInstant(value: unknown): string | null | undefined {
  if (value === null) return null;
  return isInstant(value) ? value : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const PREVIEW_KEYS = [
  "status",
  "exchange_name",
  "tint",
  "inviter_name",
  "budget_preset",
  "join_by_at",
  "gift_day",
  "joined_count",
  "closed_at",
  "cancelled_at",
  "draw_mode",
  "draw_at",
] as const;

export function parseInvitePreview(raw: unknown): InvitePreview | null {
  if (!isRecord(raw) || !hasExactKeys(raw, PREVIEW_KEYS)) return null;
  const { status, exchange_name, tint, inviter_name, budget_preset, join_by_at, gift_day, joined_count } = raw;
  const closedAt = nullableInstant(raw.closed_at);
  const cancelledAt = nullableInstant(raw.cancelled_at);
  const drawAt = nullableInstant(raw.draw_at);
  if (!oneOf(DRAW_MODES, raw.draw_mode) || drawAt === undefined) return null;
  if (!oneOf(STATUSES, status) || !nonEmptyString(exchange_name) || !oneOf(TINTS, tint)) return null;
  if (!nonEmptyString(inviter_name) || !isBudgetPreset(budget_preset) || !isInstant(join_by_at)) return null;
  if (typeof gift_day !== "string" || !YMD.test(gift_day)) return null;
  if (typeof joined_count !== "number" || !Number.isSafeInteger(joined_count) || joined_count < 0) return null;
  if (closedAt === undefined || cancelledAt === undefined) return null;
  return {
    status,
    exchangeName: exchange_name,
    tint,
    inviterName: inviter_name,
    budget: budget_preset,
    joinByAt: join_by_at,
    giftDay: gift_day,
    joinedCount: joined_count,
    closedAt,
    cancelledAt,
    drawMode: raw.draw_mode,
    drawAt,
  };
}

function parsePerson(raw: unknown): JoinPerson | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ["name", "is_organiser"])) return null;
  if (!nonEmptyString(raw.name) || typeof raw.is_organiser !== "boolean") return null;
  return { name: raw.name, isOrganiser: raw.is_organiser };
}

const JOIN_KEYS = [
  "status",
  "viewer",
  "exchange_id",
  "exchange_name",
  "tint",
  "organiser_name",
  "budget_preset",
  "join_by_at",
  "draw_mode",
  "draw_at",
  "gift_day",
  "note",
  "people",
] as const;

export function parseJoinDetails(raw: unknown): JoinDetails | null {
  if (!isRecord(raw) || !hasExactKeys(raw, JOIN_KEYS)) return null;
  const { status, viewer, exchange_id, exchange_name, tint, organiser_name, budget_preset, join_by_at, draw_mode, gift_day, note, people } = raw;
  const drawAt = nullableInstant(raw.draw_at);
  if (!oneOf(STATUSES, status) || !oneOf(VIEWERS, viewer) || !nonEmptyString(exchange_name) || !oneOf(TINTS, tint)) return null;
  if (!nonEmptyString(organiser_name) || !isBudgetPreset(budget_preset) || !isInstant(join_by_at)) return null;
  if (!oneOf(DRAW_MODES, draw_mode) || drawAt === undefined) return null;
  if (typeof gift_day !== "string" || !YMD.test(gift_day)) return null;
  if (note !== null && typeof note !== "string") return null;
  if (!Array.isArray(people)) return null;
  // WHY: an id only ever arrives for an active member; any other combination is a malformed answer.
  if (exchange_id !== null && (typeof exchange_id !== "string" || !UUID.test(exchange_id))) return null;
  if ((viewer === "member") !== (exchange_id !== null)) return null;
  const parsedPeople: JoinPerson[] = [];
  for (const person of people) {
    const one = parsePerson(person);
    if (!one) return null;
    parsedPeople.push(one);
  }
  return {
    status,
    viewer,
    exchangeId: exchange_id,
    exchangeName: exchange_name,
    tint,
    organiserName: organiser_name,
    budget: budget_preset,
    joinByAt: join_by_at,
    drawMode: draw_mode,
    drawAt,
    giftDay: gift_day,
    note: note === null || note.trim().length === 0 ? null : note,
    people: parsedPeople,
  };
}
