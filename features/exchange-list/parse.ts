import type { ListSource, MyExchangeList } from "./types";

// Strict parser for get_my_exchange_list (GC-010, GC-011). WHY exact keys: the answer is the viewer's
// own list status and nothing else; a new key (an id of someone else, a list name that is internal)
// makes the page treat the answer as unreadable instead of rendering it half-trusted.
const KEYS = ["source", "wishlist_id", "name", "item_count"] as const;
const SOURCES: readonly ListSource[] = ["none", "wishlist", "ideas", "kept"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseMyExchangeList(raw: unknown): MyExchangeList | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const actual = Object.keys(record);
  if (actual.length !== KEYS.length || !KEYS.every((k) => Object.hasOwn(record, k))) return null;

  const { source, wishlist_id: wishlistId, name, item_count: itemCount } = record;
  if (typeof source !== "string" || !(SOURCES as readonly string[]).includes(source)) return null;
  if (wishlistId !== null && !(typeof wishlistId === "string" && UUID.test(wishlistId))) return null;
  if (name !== null && typeof name !== "string") return null;
  if (typeof itemCount !== "number" || !Number.isInteger(itemCount) || itemCount < 0) return null;
  return { source: source as ListSource, wishlistId, name, itemCount };
}
