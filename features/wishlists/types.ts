import type { ItemPriority, WishlistVisibility } from "@/lib/validation/wishlist";

export type { ItemPriority, WishlistVisibility };

// WHY (GC-020, CLAUDE.md "Core security rule"): these are the owner's view types. They have no field
// for purchase marks, reservations or givers, so that data can never be passed to an owner's
// component, even by accident. They also carry no share token: the detail page gets it separately, as a ready-made link.

export type OwnerWishlistSummary = {
  id: string;
  name: string;
  visibility: WishlistVisibility;
  itemCount: number;
  updatedAt: string;
};

export type OwnerWishlist = {
  id: string;
  name: string;
  visibility: WishlistVisibility;
};

export type OwnerWishlistItem = {
  id: string;
  name: string;
  link: string | null;
  priceKobo: number | null;
  priority: ItemPriority;
  note: string | null;
  updatedAt: string;
};
