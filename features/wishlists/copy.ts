// UI copy shared by more than one wishlist component. Sources: board copy read from the canvas and
// the owner's answers of 2026-11-05 (docs/tasks/slice-2.md), stories GC-018 to GC-021. Toasts and the
// delete title use straight single quotes (owner 2026-11-05). Lines not in a story or board are
// listed in docs/copy-pending.md.

import type { RadioOption } from "@/components/ui/RadioGroup";
import { formatNaira } from "@/lib/money/naira";
import type { ItemPriority, WishlistVisibility } from "./types";

export const quoted = (name: string) => `'${name}'`;

export const WISHLIST_COPY = {
  // GC-018 who-can-see labels (Q5: Private rows say "Only you").
  rowPrivate: "Only you",
  rowLink: "Anyone with the link",
  chipPrivate: "Only you can see this",
  chipLink: "Anyone with the link can see this",
  // GC-020 rollback (Content). Only where something really is put back (a failed Undo of an item
  // removal sends the row away again).
  rollback: "Couldn't save your change, so we put it back.",
  // Owner 2026-11-08 (R1-3): a failed bin remove or undo-delete puts nothing back, so no "put it back".
  saveFailed: "Couldn't save your change.",
  retry: "Retry",
  undo: "Undo",
  // copy-pending: reused from slice 1 for a server failure inside a sheet.
  failed: "Something went wrong on our side.",
  deletedToast: (name: string) => `Deleted ${quoted(name)}.`,
} as const;

export function itemCountLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

// S20 / S23: the who-can-see choice, the same two options (and hints) in the list sheet and the
// Share sheet (GC-019, GC-022).
export const VISIBILITY_OPTIONS: readonly RadioOption<WishlistVisibility>[] = [
  { value: "private", label: "Private", hint: "Only you, and your giver in any exchange you add it to." },
  {
    value: "link",
    label: "Anyone with the link",
    hint: "Anyone you send the link to can see it. They don't need an account.",
  },
];

// GC-022 / S23 Share sheet. Boards: Wishlist-Detail-shareprivate, -shareswitching, -sharepublic,
// -sharecopied. Strings from the boards; the failure line is the owner's answer of 2026-11-08.
export const SHARE_COPY = {
  title: (name: string) => `Share “${name}”`,
  privateBody:
    "It's private, so there's no link yet. Getting one lets anyone with the link see it. Your givers keep seeing it either way.",
  visibilityLegend: "Who can see it",
  saving: "Saving…",
  getLink: "Get a shareable link",
  yourLink: "Your link",
  done: "Done",
} as const;

// GC-022: the WhatsApp message, as written in the story (straight quotes).
export function buildWhatsAppMessage(listName: string, link: string): string {
  return `Here's my wishlist, "${listName}", on Unwrap. Take a look: ${link}`;
}

export function whatsAppHref(listName: string, link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(listName, link))}`;
}

export const PRIORITY_LABEL: Record<ItemPriority, string> = {
  most_wanted: "Most wanted",
  nice_to_have: "Nice to have",
};

// "₦8,500 · Most wanted. Any colour but brown." (board row sub line). Exact prices only (GC-020).
// Shared by the owner's detail page and the public view, so the two rows read the same.
export function itemSub(item: { priceKobo: number | null; priority: ItemPriority; note: string | null }): string {
  const head = [item.priceKobo === null ? null : formatNaira(item.priceKobo), PRIORITY_LABEL[item.priority]]
    .filter((part): part is string => part !== null)
    .join(" · ");
  return item.note ? `${head}. ${item.note}` : head;
}
