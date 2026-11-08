"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isUuid,
  validateItemInput,
  validateWishlistInput,
  type ItemErrors,
  type WishlistErrors,
} from "@/lib/validation/wishlist";

// Server Actions for wishlists and items (GC-019, GC-020, GC-021). Each one validates its input,
// never takes a user id (the database reads it from the session), and returns a result instead of
// throwing. Authorisation is Row Level Security and the definer functions (plan §6); these do not
// repeat it. A refusal and a missing row look the same: "not-found".

type Failure = { ok: false; reason: "signed-out" | "not-found" | "failed" };

export type CreateWishlistResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid"; errors: WishlistErrors }
  | Failure;
export type UpdateWishlistResult = { ok: true } | { ok: false; reason: "invalid"; errors: WishlistErrors } | Failure;
export type ItemResult = { ok: true } | { ok: false; reason: "invalid"; errors: ItemErrors } | Failure;
export type SimpleResult = { ok: true } | Failure;

// WHY P0002: the definer functions raise no_data_found for "not yours", "missing" and "already in
// that state" alike (migration 20261105024047_wishlists).
const NOT_FOUND = "P0002";

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

function detailPath(wishlistId: string): string {
  return `/wishlists/${wishlistId}`;
}

// GC-019: create. New lists start Private. The caller then opens the new list (add first item).
export async function createWishlist(input: unknown): Promise<CreateWishlistResult> {
  const parsed = validateWishlistInput(input);
  if (!parsed.ok) return { ok: false, reason: "invalid", errors: parsed.errors };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };

  const { data, error } = await supabase.from("wishlists").insert(parsed.value).select("id").single();
  if (error || !data) return { ok: false, reason: "failed" };
  revalidatePath("/wishlists");
  return { ok: true, id: data.id };
}

// GC-019: rename and change who can see it.
export async function updateWishlist(id: unknown, input: unknown): Promise<UpdateWishlistResult> {
  if (!isUuid(id)) return { ok: false, reason: "not-found" };
  const parsed = validateWishlistInput(input);
  if (!parsed.ok) return { ok: false, reason: "invalid", errors: parsed.errors };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };

  const { data, error } = await supabase.from("wishlists").update(parsed.value).eq("id", id).select("id");
  if (error) return { ok: false, reason: "failed" };
  if (!data || data.length !== 1) return { ok: false, reason: "not-found" };
  revalidatePath(detailPath(id));
  revalidatePath("/wishlists");
  return { ok: true };
}

// GC-019: soft delete. WHY no revalidation of the detail page: the caller leaves it for My
// wishlists straight away, and re-rendering it first would flash the "private" state. My wishlists
// is dynamic, so it is read fresh on arrival.
export async function deleteWishlist(id: unknown): Promise<SimpleResult> {
  if (!isUuid(id)) return { ok: false, reason: "not-found" };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };

  const { error } = await supabase.rpc("delete_wishlist", { p_wishlist_id: id });
  if (error) return { ok: false, reason: error.code === NOT_FOUND ? "not-found" : "failed" };
  return { ok: true };
}

// GC-019: Undo a delete, from the toast on My wishlists.
export async function restoreWishlist(id: unknown): Promise<SimpleResult> {
  if (!isUuid(id)) return { ok: false, reason: "not-found" };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };

  const { error } = await supabase.rpc("restore_wishlist", { p_wishlist_id: id });
  if (error) return { ok: false, reason: error.code === NOT_FOUND ? "not-found" : "failed" };
  revalidatePath("/wishlists");
  revalidatePath(detailPath(id));
  return { ok: true };
}

// GC-021: add an item. Manual entry is the primary path (never-do 9); the link is stored only.
export async function addWishlistItem(wishlistId: unknown, input: unknown): Promise<ItemResult> {
  if (!isUuid(wishlistId)) return { ok: false, reason: "not-found" };
  const parsed = validateItemInput(input);
  if (!parsed.ok) return { ok: false, reason: "invalid", errors: parsed.errors };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };

  const { name, link, priceKobo, priority, note } = parsed.value;
  const { error } = await supabase
    .from("wishlist_items")
    .insert({ wishlist_id: wishlistId, name, link, price_kobo: priceKobo, priority, note });
  // WHY 42501 is "not-found": RLS refuses an insert into a list that is not the caller's live list.
  if (error) return { ok: false, reason: error.code === "42501" ? "not-found" : "failed" };
  revalidatePath(detailPath(wishlistId));
  revalidatePath("/wishlists");
  return { ok: true };
}

// GC-021: edit an item.
export async function updateWishlistItem(itemId: unknown, input: unknown): Promise<ItemResult> {
  if (!isUuid(itemId)) return { ok: false, reason: "not-found" };
  const parsed = validateItemInput(input);
  if (!parsed.ok) return { ok: false, reason: "invalid", errors: parsed.errors };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };

  const { name, link, priceKobo, priority, note } = parsed.value;
  const { data, error } = await supabase
    .from("wishlist_items")
    .update({ name, link, price_kobo: priceKobo, priority, note })
    .eq("id", itemId)
    .select("wishlist_id");
  if (error) return { ok: false, reason: "failed" };
  const row = data?.[0];
  if (!row || data.length !== 1) return { ok: false, reason: "not-found" };
  revalidatePath(detailPath(row.wishlist_id));
  revalidatePath("/wishlists");
  return { ok: true };
}

// GC-020: the bin on a row, and its Undo. The page passes its own list id so it re-renders.
async function setItemRemoved(wishlistId: unknown, itemId: unknown, removed: boolean): Promise<SimpleResult> {
  if (!isUuid(wishlistId) || !isUuid(itemId)) return { ok: false, reason: "not-found" };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };

  const { error } = removed
    ? await supabase.rpc("remove_wishlist_item", { p_item_id: itemId })
    : await supabase.rpc("restore_wishlist_item", { p_item_id: itemId });
  if (error) return { ok: false, reason: error.code === NOT_FOUND ? "not-found" : "failed" };
  revalidatePath(detailPath(wishlistId));
  revalidatePath("/wishlists");
  return { ok: true };
}

export async function removeWishlistItem(wishlistId: unknown, itemId: unknown): Promise<SimpleResult> {
  return setItemRemoved(wishlistId, itemId, true);
}

export async function restoreWishlistItem(wishlistId: unknown, itemId: unknown): Promise<SimpleResult> {
  return setItemRemoved(wishlistId, itemId, false);
}
