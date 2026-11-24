// UI copy for the recipient's wishlist (GC-015; S16 and S17). Sources: boards Exchange-Wishlist-default, -loading, -empty,
// -nolist, -error, -offline, -marked, -removed, Exchange-Wishlist-item, -itemgot, -itembusy, -itemoffline, -nolink, -copied
// (canvas "Unwrap", read into docs/tasks/slice-11-boards.md) and the GC-015 story. Lines marked "pending" have no board
// and no story line and are listed in docs/copy-pending.md for approval (CLAUDE.md "Before coding a slice", rule 5).
// WHY the boards win where the story differs (owner B2, 2026-11-23): the list and the item sheet read "Only you can see what
// you mark." The Reveal page keeps its own "Only you can see this." line (features/draw/copy.ts).

import type { BudgetFit } from "@/lib/money/budget";

export const GIFT_COPY = {
  // Board: "Kemi's wishlist".
  title: (first: string) => `${first}'s wishlist`,
  // pending: the board shows the name while loading, but the name is never in the server HTML (slice-10 AC-12, owner B3).
  loadingTitle: "Their wishlist",
  // Board: "You're buying for Kemi Bello. Spend ₦15,000 to ₦25,000. Gifts are exchanged on Sat 19 Dec."
  intro: (full: string, spend: string, gift: string) => `You're buying for ${full}. Spend ${spend}. Gifts are exchanged on ${gift}.`,
  recentFirst: "Recently changed first",
  // Board: "Only you can see what you mark. Kemi never will."
  hint: (first: string) => `Only you can see what you mark. ${first} never will.`,

  // Empty (board Exchange-Wishlist-empty; GC-015 Content).
  emptyTitle: "They haven't added anything yet",
  emptyBody: (gift: string, first: string) => `Check back closer to ${gift}. New items show here as soon as ${first} adds them.`,

  // No list (board Exchange-Wishlist-nolist). WHY no full stop: the board's heading has none.
  noListTitle: (first: string) => `${first} hasn't added a wishlist yet`,
  // WHY not the board's "{organiser} can send a reminder. Until then, ...": nudges are refused once names are drawn, so the
  // line would promise something the organiser cannot do (owner decision 2026-11-23). Pending approval in copy-pending.
  noListBody: "The budget is your best guide for now.",

  // Error (board Exchange-Wishlist-error). The name only after an earlier successful load (owner B3).
  loadError: (first: string) => `We couldn't load ${first}'s wishlist. Nothing you marked is lost.`,
  // pending: the neutral form, for a first load that failed (the name has not been read yet).
  loadErrorNeutral: "We couldn't load their wishlist. Nothing you marked is lost.",
  tryAgain: "Try again",

  // Hidden on this device (owner Q3, B4). Title and Show are the approved lines of the exchange page row.
  hiddenBody: "Show who you're buying for to open their wishlist.", // pending: no board for /recipient while hidden.

  // Taken off the list (board Exchange-Wishlist-removed).
  takenOff: (first: string, item: string) => `${first} took “${item}” off the list after you marked it. You can still unmark it.`,
  // pending: no board for a person who removed the whole list (owner Q6).
  takenOffList: (first: string, item: string) => `${first} no longer has a list here, so “${item}” isn't on it. You can still unmark it.`,
  unmark: "Unmark",
  unmarkLabel: (item: string) => `Unmark “${item}”`,

  // Row trailing badges (boards: "Updated", "You got this", "Over budget").
  updated: "Updated",
  gotThis: "You got this",
  overBudget: "Over budget",

  // Item sheet (S17).
  openShop: "Open the shop",
  copyLink: "Copy link",
  iGotThis: "I got this",
  notGot: "I haven't got it after all",
  close: "Close",
  noLink: "No shop link. The name and note are all there is.",
  // Board: "You're offline, so marking is off for now. The shop link still works."
  offlineSheet: "You're offline, so marking is off for now. The shop link still works.",
  copied: "Link copied. Paste it anywhere to share.", // Board Exchange-Wishlist-copied (same line as Share).
  // pending: no board for a refused copy.
  copyFailed: "We couldn't copy the link. Open the shop and copy it from there.",
  // Board: "Within the ₦15,000 to ₦25,000 budget." Over and Under have no board (pending).
  budgetNote: (fit: BudgetFit, range: string) =>
    `${fit === "within" ? "Within" : fit === "over" ? "Over" : "Under"} the ${range} budget.`,
  quoted: (note: string) => `“${note}”`,

  // Toasts. Board Exchange-Wishlist-marked.
  marked: (item: string) => `Marked “${item}” as got. Only you can see this.`,
  // pending: no board for the undo of a mark.
  unmarked: (item: string) => `Unmarked “${item}”. Only you can see this.`,
  // pending: the item left the list, or the mark can't be changed any more, between loading and tapping.
  itemGone: "That item isn't on the list any more. We refreshed the list.",

  // The revealed ActionCard (board Exchange-Detail-revealed).
  cardTitle: (first: string) => `You're buying for ${first}.`,
  // Never seen or read: the card holds its place invisibly while the name loads.
  cardTitleLoading: "You're buying for someone.",
  cardSub: (spend: string, gift: string) => `Spend ${spend}. Gifts are exchanged on ${gift}.`,
} as const;
