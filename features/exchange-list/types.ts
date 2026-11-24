import type { ExchangeTint } from "@/components/ui/ExchangeTag";
import type { Schedule } from "@/features/exchanges/types";
import type { BudgetPreset } from "@/lib/money/budget";
import type { OwnerWishlistItem, OwnerWishlistSummary } from "@/features/wishlists/types";

export type { OwnerWishlistItem, OwnerWishlistSummary };

// GC-010 / GC-011 / GCO-004 S49: what a person has offered in one exchange, as get_my_exchange_list
// answers it. none: nothing, or an ideas list with no items. kept: the wishlist was deleted and its
// items are kept for the giver (GC-030).
export type ListSource = "none" | "wishlist" | "ideas" | "kept";

// WHY no field for anyone else: the function answers about the caller only (pair secrecy, plan inv. 8).
export type MyExchangeList = {
  source: ListSource;
  /** The attached list. For "none" it is set only when an empty ideas list is attached. */
  wishlistId: string | null;
  /** The personal list's name, or the name it had when deleted. Never the ideas list's internal name. */
  name: string | null;
  itemCount: number;
};

// The exchange as the attach and You're in pages need it. Members only; no token, no other people.
export type ExchangeListContext = Schedule & {
  id: string;
  name: string;
  tint: ExchangeTint;
  budget: BudgetPreset;
  isOrganiser: boolean;
  takingPart: boolean;
  /** Names are drawn (or the gift day has passed): the list can only be added when nothing is attached, or removed (GC-010). */
  afterDraw: boolean;
  /** Only read for the organiser-draws wording on You're in. */
  organiserName: string | null;
  /**
   * Whether joining has closed. WHY GC-011: when true and draw_mode is at_join_by, the dated draw
   * step is suppressed (the join-by has passed but the draw hasn't run — showing a past-tense date
   * as a future step is misleading). Also suppresses join-by reminder promise lines (R1-1, R1-4):
   * tick() only queues E23 while the exchange is open, so showing the promise after joining closes
   * is false.
   */
  joiningClosed: boolean;
  /**
   * When the viewer joined this exchange. Used to suppress the join-by reminder promise for late
   * joiners (R1-2): tick() only queues E23 when the member joined at least 24 h before join-by.
   */
  joinedAt: string | null;
};

// The viewer's hidden-or-attached ideas for this exchange (GC-010): the list id and its live items.
export type MyIdeas = { listId: string | null; items: OwnerWishlistItem[] };

export type ListMode = "participant" | "organiser";
