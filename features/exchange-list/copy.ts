// UI copy for Attach list (S11, S49) and You're in (S12). Boards: Joining-Attach-*, Joining-In-*,
// Org-List-* (the boards decide where they differ from the story, owner decision Q9, 2026-11-13).
// Names go in single quotes (owner decision Q9). Lines with no board and no story are listed in
// docs/copy-pending.md.

import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { itemCountLabel } from "@/features/wishlists/copy";
import { budgetLabel, type BudgetPreset } from "@/lib/money/budget";
import type { ListMode, ListSource } from "./types";

const q = (name: string) => `'${name}'`;

export const LIST_COPY = {
  youJoined: "You've joined",
  participantTitle: "Tell your giver what you'd like",
  organiserTitle: "Your list for this exchange",
  pickIntro: "Pick one of your wishlists, or add a few ideas just for this exchange.",
  privacy: "Only your giver will see it, and only after names are drawn.",
  currentIntro: "Your giver will see it after the draw. You can change it until then.",
  noLists: "You don't have any wishlists yet, so add a few items instead.",
  choose: "Choose a wishlist",
  chooseDifferent: "Choose a different wishlist",
  addItems: "Add items instead",
  skip: "Skip for now",
  back: "Back",
  done: "Done",
  addAnother: "Add another item",
  tryAgain: "Try again",
  // Picker sheet (UwSheet picker).
  pickerTitle: "Choose a wishlist",
  pickerLegend: "Your wishlists",
  use: "Use this wishlist",
  cancel: "Cancel",
  pickerFailed: "We couldn't load your wishlists. Nothing has changed.",
  // Ideas.
  ideasSub: "Only for this exchange",
  itemSheetNote: "Only the person who draws your name will see it. It won't be added to your wishlists.",
  // Toasts on the exchange page (GCO-004 S49 update, 2026-11-09).
  toastAttached: "Wishlist attached. Your giver will see it after the draw.",
  toastReady: "Your list is ready. Your giver will see it after the draw.",
  // Failure: the approved load-error line of the exchange page, reused (S14 Exchange-Detail-error).
  loadError: EXCHANGE_COPY.detail.loadError,
} as const;

export const ideasHeading = (count: number) => `Your list for this exchange (${count})`;
export const addedToast = (name: string) => `Added ${q(name)}.`;
export const removedToast = (name: string) => `Removed ${q(name)}.`;
export const attachFailed = (name: string) =>
  `We couldn't attach ${q(name)}. Nothing has changed, so you can try again.`;
export const listGone = (name: string) => `${q(name)} was just deleted, so we refreshed your wishlists.`;
export const removeLabel = (name: string) => `Remove ${name}`;

// "Gifts here cost ₦5,000 to ₦10,000, so ideas in that range help most." (participant board) and
// "Everyone spends ₦10,000 to ₦20,000, ..." (organiser board). WHY the top preset reads "more than":
// budgetLabel gives "Above ₦50,000", which does not follow "cost" or "spends". Pending (copy-pending).
export function budgetPhrase(budget: BudgetPreset): string {
  return budgetLabel(budget).replace(/^Above /, "more than ");
}

export function budgetGuide(mode: ListMode, budget: BudgetPreset): string {
  const phrase = budgetPhrase(budget);
  const head = mode === "organiser" ? `Everyone spends ${phrase}` : `Gifts here cost ${phrase}`;
  return `${LIST_COPY.pickIntro} ${head}, so ideas in that range help most.`;
}

// Helper under Price in the item sheet (S49 boards).
export const priceHelper = (budget: BudgetPreset) => `Your budget here is ${budgetPhrase(budget)}.`;

// The three sources of "Your list for this exchange", named in a subline (GC-010 Context D).
export function sourceSubline(source: ListSource, name: string | null): string | null {
  switch (source) {
    case "wishlist":
      return name ? `From ${q(name)}. Changes when you edit that list.` : null;
    case "ideas":
      return "Only for this exchange.";
    case "kept":
      return "Kept from a list you deleted. It can't be changed now.";
    case "none":
      return null;
  }
}

export const ideaCountLabel = (count: number) => (count === 1 ? "1 idea" : `${count} ideas`);

export const savedToast = (name: string) => `Saved ${q(name)}.`;

// The row for an attached list on the current-list page (Org-List-current: "6 items · updated Sat 31 Oct").
// A kept list has no updated date worth showing (it can't change); it shows its source subline.
export function currentRow(
  list: { source: ListSource; name: string | null; itemCount: number },
  updatedLabel: string | null,
): { title: string; sub: string } | null {
  if (list.source === "wishlist") {
    const count = itemCountLabel(list.itemCount);
    return { title: list.name ?? LIST_COPY.organiserTitle, sub: updatedLabel ? `${count} · updated ${updatedLabel}` : count };
  }
  if (list.source === "kept") {
    return { title: list.name ?? LIST_COPY.organiserTitle, sub: sourceSubline("kept", list.name) ?? "" };
  }
  return null;
}

// The subline of "Your list for this exchange" on the exchange page (boards Exchange-Detail-before,
// -nolist, -oattached, -oideas, -ostarted). Names in single quotes (owner Q9). WHY a kept list says only
// its source line: it can't change, so "You can change it" would be untrue.
export function yourListSubline(
  list: { source: ListSource; name: string | null; itemCount: number },
  mode: ListMode,
): string {
  const count = itemCountLabel(list.itemCount);
  switch (list.source) {
    case "wishlist":
      return `From ${q(list.name ?? "")}. ${count}. You can change it until the draw.`;
    case "ideas":
      return `Only for this exchange. ${count}. You can change ${list.itemCount === 1 ? "it" : "them"} until the draw.`;
    case "kept":
      return sourceSubline("kept", list.name) ?? "";
    case "none":
      return mode === "organiser" ? EXCHANGE_COPY.detail.listNoneOrganiser : EXCHANGE_COPY.detail.listNoneParticipant;
  }
}
