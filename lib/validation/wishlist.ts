import { parseNairaInput } from "../money/naira";
import { clampCodePoints, normaliseSingleLine } from "./text";

// Form rules for wishlists and items (GC-019, GC-021). The database CHECK constraints are the source
// of truth (plan §8); these give inline errors first and send only clean values. Pure: used by the
// sheets in the browser and again by the Server Actions, which never trust the browser's copy.

export const WISHLIST_NAME_MAX = 60;
export const ITEM_NAME_MAX = 120;
export const ITEM_NOTE_MAX = 280;
export const ITEM_LINK_MAX = 2048;

export type WishlistVisibility = "private" | "link";
export type ItemPriority = "most_wanted" | "nice_to_have";

export type WishlistInput = { name: string; visibility: WishlistVisibility };
export type WishlistErrors = { name?: "missing" };

export type ItemInput = {
  name: string;
  link: string | null;
  priceKobo: number | null;
  priority: ItemPriority;
  note: string | null;
};
export type ItemErrors = {
  name?: "missing";
  price?: "not-whole-naira" | "too-large";
  link?: "invalid";
};

export type Validation<T, E> = { ok: true; value: T } | { ok: false; errors: E };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function isVisibility(value: unknown): value is WishlistVisibility {
  return value === "private" || value === "link";
}

export function isPriority(value: unknown): value is ItemPriority {
  return value === "most_wanted" || value === "nice_to_have";
}

// WHY: Server Actions take ids from the browser. A malformed one is "not found", never a database
// error that could say more (GC-018 edge case).
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validateWishlistInput(raw: unknown): Validation<WishlistInput, WishlistErrors> {
  const input = isRecord(raw) ? raw : {};
  const name = normaliseSingleLine(str(input.name), WISHLIST_NAME_MAX);
  // WHY default Private: new lists start Private (GC-019).
  const visibility = isVisibility(input.visibility) ? input.visibility : "private";
  if (name === "") return { ok: false, errors: { name: "missing" } };
  return { ok: true, value: { name, visibility } };
}

// The note keeps its line breaks; only the ends are trimmed. A blank note is no note.
export function normaliseNote(input: string): string | null {
  const note = clampCodePoints(input.trim(), ITEM_NOTE_MAX).trim();
  return note === "" ? null : note;
}

export type LinkParse = { ok: true; link: string | null } | { ok: false };

// GC-021: "Links without https:// are accepted", so a link with no scheme gets https:// in front.
// Any other scheme (javascript:, data:, ftp:, mailto:) is refused. The link is stored and shown only;
// slice 2 never fetches it (owner 2026-11-05, Q9).
export function normaliseLink(input: string): LinkParse {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, link: null };
  if (/\s/.test(trimmed)) return { ok: false };
  // WHY the digit check: "shop.example:8080/x" has a port, not a scheme.
  const scheme = /^([a-z][a-z0-9+.-]*):(?!\d)/i.exec(trimmed)?.[1]?.toLowerCase();
  let link: string;
  if (scheme === undefined) link = `https://${trimmed}`;
  else if (scheme === "http" || scheme === "https") link = trimmed;
  else return { ok: false };
  if (!/^https?:\/\/\S+$/i.test(link) || link.length > ITEM_LINK_MAX) return { ok: false };
  try {
    const url = new URL(link);
    if (url.hostname === "") return { ok: false };
  } catch {
    return { ok: false };
  }
  return { ok: true, link };
}

export function validateItemInput(raw: unknown): Validation<ItemInput, ItemErrors> {
  const input = isRecord(raw) ? raw : {};
  const errors: ItemErrors = {};

  const name = normaliseSingleLine(str(input.name), ITEM_NAME_MAX);
  if (name === "") errors.name = "missing";

  const price = parseNairaInput(str(input.price));
  if (!price.ok) errors.price = price.reason;

  const link = normaliseLink(str(input.link));
  if (!link.ok) errors.link = "invalid";

  // WHY default Nice to have: owner 2026-11-05 (Q7) preselects it.
  const priority = isPriority(input.priority) ? input.priority : "nice_to_have";
  const note = normaliseNote(str(input.note));

  if (!price.ok || !link.ok || name === "") return { ok: false, errors };
  return { ok: true, value: { name, link: link.link, priceKobo: price.kobo, priority, note } };
}
