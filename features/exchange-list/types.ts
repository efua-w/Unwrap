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
  /** Only read for the organiser-draws wording on You're in. */
  organiserName: string | null;
};

// The viewer's hidden-or-attached ideas for this exchange (GC-010): the list id and its live items.
export type MyIdeas = { listId: string | null; items: OwnerWishlistItem[] };

export type ListMode = "participant" | "organiser";
