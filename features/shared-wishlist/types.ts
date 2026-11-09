import type { ItemPriority } from "@/lib/validation/wishlist";

// WHY (GC-020, GC-023, CLAUDE.md "Core security rule"): the public view's types have exactly the
// fields get_shared_wishlist returns, and no more. There is no owner id, item id, photo path,
// timestamp, mark or giver here, so none of it can reach the public page or its components.
export type PublicWishlistItem = {
  name: string;
  link: string | null;
  priceKobo: number | null;
  priority: ItemPriority;
  note: string | null;
};

export type PublicWishlist = {
  name: string;
  ownerDisplayName: string;
  items: PublicWishlistItem[];
};
