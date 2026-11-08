import "server-only";
import { isUuid } from "@/lib/validation/wishlist";
import { createClient } from "@/lib/supabase/server";
import type { OwnerWishlist, OwnerWishlistItem, OwnerWishlistSummary } from "./types";

// Reads for the owner's wishlist pages (GC-018, GC-020). Every query runs under the signed-in
// person's Row Level Security, which already limits rows to their own live lists and items; the
// queries name their columns, so nothing else (share token, photo path, deleted rows) reaches a page.

// My wishlists, most recently changed first. The item count comes through RLS, so removed items are
// not counted. Ideas lists belong to exchanges and never show here.
export async function listMyWishlists(): Promise<OwnerWishlistSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wishlists")
    .select("id, name, visibility, updated_at, wishlist_items(count)")
    .eq("kind", "personal")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Could not read wishlists.");
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    visibility: row.visibility,
    itemCount: row.wishlist_items[0]?.count ?? 0,
    updatedAt: row.updated_at,
  }));
}

// GC-018: "first time" and "all my lists deleted" look different.
export async function hasDeletedWishlists(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_deleted_wishlists");
  if (error) throw new Error("Could not read wishlists.");
  return data === true;
}

export type MyWishlistDetail = { list: OwnerWishlist; items: OwnerWishlistItem[] };

// One list with its items, or null when it is missing, deleted or someone else's. The three cases
// are deliberately the same answer (GC-018 edge case: never say which).
export async function getMyWishlist(id: string): Promise<MyWishlistDetail | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data: list, error } = await supabase
    .from("wishlists")
    .select("id, name, visibility")
    .eq("id", id)
    .eq("kind", "personal")
    .maybeSingle();
  if (error) throw new Error("Could not read the wishlist.");
  if (!list) return null;

  const { data: items, error: itemsError } = await supabase
    .from("wishlist_items")
    .select("id, name, link, price_kobo, priority, note, updated_at")
    .eq("wishlist_id", id)
    .order("updated_at", { ascending: false });
  if (itemsError) throw new Error("Could not read the wishlist items.");

  return {
    list: { id: list.id, name: list.name, visibility: list.visibility },
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      link: item.link,
      priceKobo: item.price_kobo,
      priority: item.priority,
      note: item.note,
      updatedAt: item.updated_at,
    })),
  };
}
