import { firstName } from "@/features/joining/copy";
import { DRAW_COPY } from "./copy";
import type { DrawBlockReason, DrawSummary, ListState, MostWantedItem, MyAssignment, Recipient } from "./types";

// Pure helpers for the draw and reveal screens (GCO-011, GCO-012, GC-014).

// WHY 3 (story GCO-011, plan §6): the engine refuses fewer; the screen says so first.
export const MIN_PEOPLE = 3;

/** How many more people the draw needs. Zero once there are enough. */
export function peopleStillNeeded(peopleIn: number): number {
  return Math.max(0, MIN_PEOPLE - peopleIn);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_STATES: readonly ListState[] = ["none", "empty", "items"];

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

// WHY strict, with exact keys: the recipient is the most sensitive row in the product. A key the screen does not know
// (an id, a list name, a link) refuses the whole answer, so nothing extra can ride along to the page (AC-5, AC-6).
const RECIPIENT_KEYS = ["display_name", "avatar_path", "list_state", "most_wanted"] as const;
const ITEM_KEYS = ["ref", "name", "price_kobo"] as const;

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(record).length === keys.length && keys.every((k) => Object.hasOwn(record, k));
}

export function parseMostWanted(raw: unknown): MostWantedItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: MostWantedItem[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || !hasExactKeys(entry, ITEM_KEYS)) return null;
    const { name, price_kobo } = entry;
    if (typeof name !== "string" || name.trim() === "") return null;
    if (price_kobo !== null && (typeof price_kobo !== "number" || !Number.isInteger(price_kobo) || price_kobo < 0)) return null;
    // WHY `ref` is kept now (slice 11): the row opens that item's sheet on the recipient's list.
    if (typeof entry.ref !== "string" || entry.ref === "") return null;
    items.push({ ref: entry.ref, name, priceKobo: price_kobo });
  }
  return items;
}

/** The first row of get_my_recipient, or null when it is not exactly the shape the screen may carry. */
export function parseRecipient(raw: unknown): Recipient | null {
  if (!isRecord(raw) || !hasExactKeys(raw, RECIPIENT_KEYS)) return null;
  const { display_name, avatar_path, list_state, most_wanted } = raw;
  if (typeof display_name !== "string" || display_name.trim() === "") return null;
  if (avatar_path !== null && typeof avatar_path !== "string") return null;
  if (typeof list_state !== "string" || !(LIST_STATES as readonly string[]).includes(list_state)) return null;
  const mostWanted = parseMostWanted(most_wanted);
  if (mostWanted === null) return null;
  return { displayName: display_name, avatarPath: avatar_path, listState: list_state as ListState, mostWanted };
}

export function parseAssignment(raw: unknown): MyAssignment | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ["assignment_id", "revealed"])) return null;
  const { assignment_id, revealed } = raw;
  if (typeof assignment_id !== "string" || !UUID.test(assignment_id) || typeof revealed !== "boolean") return null;
  return { assignmentId: assignment_id, revealed };
}

export function parseSummary(raw: unknown): DrawSummary | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ["people_count", "drawn_at", "emails_queued"])) return null;
  const { people_count, drawn_at, emails_queued } = raw;
  if (typeof people_count !== "number" || !Number.isInteger(people_count) || people_count < 1) return null;
  if (typeof drawn_at !== "string" || Number.isNaN(Date.parse(drawn_at))) return null;
  if (typeof emails_queued !== "number" || !Number.isInteger(emails_queued) || emails_queued < 0) return null;
  // WHY capped: a later re-draw can leave older cancelled rows out, but a count above the people is never true.
  return { peopleCount: people_count, drawnAt: drawn_at, told: Math.min(emails_queued, people_count) };
}

/** The first name on Reveal's own lines ("Only you can see this. Kemi never will."). */
export function recipientFirst(recipient: Recipient): string {
  return firstName(recipient.displayName);
}

/** The Names drawn page body: the board's line when everyone was emailed, the pending one when not (Q3). */
export function drawnBody(summary: DrawSummary): string {
  return summary.told >= summary.peopleCount ? DRAW_COPY.drawnBody : DRAW_COPY.drawnBodyPartial;
}

/**
 * The reason a scheduled draw is blocked, from get_draw_blocked_reason: no row means "not blocked, or not yours to know".
 * WHY strict: the answer is one word, so a row with any other key or value is refused whole.
 */
export function parseBlockedReason(raw: unknown): DrawBlockReason | null | undefined {
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return null;
  const [row] = raw;
  if (raw.length !== 1 || !isRecord(row) || !hasExactKeys(row, ["reason"])) return undefined;
  return row.reason === "few" || row.reason === "exclusions" ? row.reason : undefined;
}

/**
 * True when an automatic draw's moment has passed without names being drawn: joining has closed (so the join-by moment, which is
 * the draw moment, is behind us) and the exchange is not drawn. WHY from the state and the mode only, never from the blocked
 * reason: a member may not learn that the draw failed or why (Q5, Q6), and this is the same answer whether the draw is
 * blocked or simply has not run yet. Anything dated about "when names are drawn" is then out of date and is left out.
 */
export function drawDatePassed(state: string, drawMode: string): boolean {
  return state === "joining_closed" && drawMode === "at_join_by";
}

/** How many more people a blocked draw needs, as a sentence for the organiser's card (board Exchange-Detail-ofailed, counts not names). */
export function blockedFewBody(peopleIn: number): string {
  const more = peopleStillNeeded(peopleIn);
  const moreText = `${more} more ${more === 1 ? "person is" : "people are"} needed.`;
  if (peopleIn <= 0) return `${DRAW_COPY.blocked.fewNobody} ${moreText}`;
  return `${DRAW_COPY.blocked.fewSome(peopleIn)} ${moreText}`;
}
