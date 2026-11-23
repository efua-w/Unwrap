import { firstName } from "@/features/joining/copy";
import type { BudgetFit } from "@/lib/money/budget";
import type { ListState } from "@/features/draw/types";
import type { ItemPriority } from "@/features/wishlists/types";
import type { RecipientItem, RecipientList, TakenOffItem } from "./types";

// Pure helpers for the recipient's wishlist (GC-015).

const LIST_STATES: readonly ListState[] = ["none", "empty", "items"];
const PRIORITIES: readonly ItemPriority[] = ["most_wanted", "nice_to_have"];

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(record).length === keys.length && keys.every((k) => Object.hasOwn(record, k));
}

// WHY strict, with exact keys: this is the most sensitive answer in the product (a person's list and a giver's marks).
// A key the screen does not know (an item id, a wishlist id, a list name, a source) refuses the whole answer, so nothing
// extra can ride along to the page (GC-015 RAIDS, AC-4).
const ANSWER_KEYS = ["display_name", "avatar_path", "list_state", "items", "taken_off"] as const;
const ITEM_KEYS = ["ref", "name", "priority", "note", "price_kobo", "link", "updated", "got"] as const;
const TAKEN_OFF_KEYS = ["ref", "name"] as const;

// WHY only http and https: the link becomes an href, and a stranger typed it. Anything else (javascript:, data:) refuses.
function isShopLink(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function parseItem(raw: unknown): RecipientItem | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ITEM_KEYS)) return null;
  const { ref, name, priority, note, price_kobo, link, updated, got } = raw;
  if (typeof ref !== "string" || ref === "") return null;
  if (typeof name !== "string" || name.trim() === "") return null;
  if (typeof priority !== "string" || !(PRIORITIES as readonly string[]).includes(priority)) return null;
  if (note !== null && typeof note !== "string") return null;
  if (price_kobo !== null && (typeof price_kobo !== "number" || !Number.isInteger(price_kobo) || price_kobo < 0)) return null;
  if (link !== null && (typeof link !== "string" || !isShopLink(link))) return null;
  if (typeof updated !== "boolean" || typeof got !== "boolean") return null;
  return { ref, name, priority: priority as ItemPriority, note, priceKobo: price_kobo, link, updated, got };
}

function parseTakenOff(raw: unknown): TakenOffItem | null {
  if (!isRecord(raw) || !hasExactKeys(raw, TAKEN_OFF_KEYS)) return null;
  const { ref, name } = raw;
  if (typeof ref !== "string" || ref === "" || typeof name !== "string" || name.trim() === "") return null;
  return { ref, name };
}

function parseAll<T>(raw: unknown, one: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const out: T[] = [];
  for (const entry of raw) {
    const parsed = one(entry);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

/** The first row of open_recipient_list, or null when it is not exactly the shape the screen may carry. */
export function parseRecipientList(raw: unknown): RecipientList | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ANSWER_KEYS)) return null;
  const { display_name, avatar_path, list_state, items, taken_off } = raw;
  if (typeof display_name !== "string" || display_name.trim() === "") return null;
  if (avatar_path !== null && typeof avatar_path !== "string") return null;
  if (typeof list_state !== "string" || !(LIST_STATES as readonly string[]).includes(list_state)) return null;
  const parsedItems = parseAll(items, parseItem);
  const parsedTaken = parseAll(taken_off, parseTakenOff);
  if (parsedItems === null || parsedTaken === null) return null;
  return {
    displayName: display_name,
    avatarPath: avatar_path,
    listState: list_state as ListState,
    items: parsedItems,
    takenOff: parsedTaken,
  };
}

export type RowBadge = "got" | "over" | "updated";

// WHY one badge per row, in this order (main-session decision 2026-11-23, board conflict 9): the board's row has one trailing
// slot and no combined design. "You got this" is the giver's own state, so it wins; "Over budget" is a warning the giver
// still needs once they have not bought it; "Updated" is the least urgent.
export function rowBadge(item: Pick<RecipientItem, "got" | "updated">, fit: BudgetFit | null): RowBadge | null {
  if (item.got) return "got";
  if (fit === "over") return "over";
  if (item.updated) return "updated";
  return null;
}

/** The person's first name for lines that use it ("Kemi's wishlist"). */
export function recipientFirstName(list: Pick<RecipientList, "displayName">): string {
  return firstName(list.displayName);
}

// The budget as budgetLabel prints it ("Above ₦50,000" for the top preset) does not read after "Spend", so the word goes
// lower-case: "Spend above ₦50,000." The other presets read as they are: "Spend ₦15,000 to ₦25,000."
export function spendWords(spend: string): string {
  return spend.replace(/^Above /, "above ");
}
