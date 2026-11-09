import { isPriority } from "@/lib/validation/wishlist";
import type { PublicWishlist, PublicWishlistItem } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === "string" ? value : undefined;
}

function parseItem(raw: unknown): PublicWishlistItem | null {
  if (!isRecord(raw)) return null;
  const { name, link, price_kobo: price, priority, note } = raw;
  const parsedLink = nullableString(link);
  const parsedNote = nullableString(note);
  if (typeof name !== "string" || parsedLink === undefined || parsedNote === undefined) return null;
  if (price !== null && !(typeof price === "number" && Number.isSafeInteger(price))) return null;
  if (!isPriority(priority)) return null;
  // WHY: the database only stores http(s) links, but the page turns this into an href that strangers
  // tap, so anything else is dropped here as well (defence in depth; a row without a link is not tappable).
  const safeLink = parsedLink !== null && /^https?:\/\/\S+$/i.test(parsedLink) ? parsedLink : null;
  return { name, link: safeLink, priceKobo: price, priority, note: parsedNote };
}

// The RPC answers null for every unavailable case (private, deleted, unknown, malformed token), and
// a JSON object otherwise. Anything that is not exactly that shape is treated as unavailable rather
// than rendered half-trusted. Only the named fields are copied, so an unexpected extra key (such as
// one added to the function by mistake) can never reach a component.
export function parsePublicWishlist(raw: unknown): PublicWishlist | null {
  if (!isRecord(raw)) return null;
  const { name, owner_display_name: owner, items } = raw;
  if (typeof name !== "string" || typeof owner !== "string" || !Array.isArray(items)) return null;
  const parsed: PublicWishlistItem[] = [];
  for (const item of items) {
    const one = parseItem(item);
    if (!one) return null;
    parsed.push(one);
  }
  return { name, ownerDisplayName: owner, items: parsed };
}
