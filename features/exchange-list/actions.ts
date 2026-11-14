"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid, validateItemInput, type ItemErrors } from "@/lib/validation/wishlist";
import { getMyPersonalLists } from "./queries";
import type { OwnerWishlistSummary } from "./types";

// Server Actions for Attach list (GC-010, GCO-004 S49). Each validates its input, never takes a user
// id (the definer functions read the caller from the session), and returns a result instead of
// throwing. The rules (who may attach what, in which state) live in the database; these only map its
// answers. Pair secrecy: nothing here reads or returns another person's data.

type Failure = { ok: false; reason: "signed-out" | "not-found" | "not-available" | "failed" };

export type AttachResult = { ok: true } | Failure;
export type IdeasResult = { ok: true; listId: string } | Failure;
// WHY a narrower failure for items: the item sheet shares its result shape with wishlist items.
type ItemFailure = { ok: false; reason: "signed-out" | "not-found" | "failed" };
export type AddIdeaResult = { ok: true; id: string } | { ok: false; reason: "invalid"; errors: ItemErrors } | ItemFailure;
export type UpdateIdeaResult = { ok: true } | { ok: false; reason: "invalid"; errors: ItemErrors } | ItemFailure;
export type PickerResult = { ok: true; wishlists: OwnerWishlistSummary[] } | Failure;

// WHY P0002 is "not-found": attach_wishlist raises it for a list that is gone or not yours, and for an
// exchange that is no longer open to this person, alike. 22023 is only "just organising".
const NOT_FOUND = "P0002";
const SIGNED_OUT = "42501";
const NOT_TAKING_PART = "22023";

function failureFor(code: string | undefined): Failure {
  if (code === SIGNED_OUT) return { ok: false, reason: "signed-out" };
  if (code === NOT_FOUND) return { ok: false, reason: "not-found" };
  if (code === NOT_TAKING_PART) return { ok: false, reason: "not-available" };
  return { ok: false, reason: "failed" };
}

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

function revalidateExchange(exchangeId: string) {
  for (const path of ["", "/list", "/my-list", "/joined"]) revalidatePath(`/exchanges/${exchangeId}${path}`);
  revalidatePath("/exchanges");
}

// The picker reads fresh each time it opens, so a list deleted in another tab is not offered.
export async function listPickerWishlists(): Promise<PickerResult> {
  if (!(await signedInClient())) return { ok: false, reason: "signed-out" };
  try {
    return { ok: true, wishlists: await getMyPersonalLists() };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

// "Use this wishlist": attach one of my own lists. It replaces ideas (kept hidden, GC-010).
export async function attachWishlistToExchange(exchangeId: unknown, wishlistId: unknown): Promise<AttachResult> {
  if (!isUuid(exchangeId) || !isUuid(wishlistId)) return { ok: false, reason: "not-found" };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };
  const { error } = await supabase.rpc("attach_wishlist", { p_exchange: exchangeId, p_wishlist: wishlistId });
  if (error) return failureFor(error.code);
  revalidateExchange(exchangeId);
  return { ok: true };
}

// "Add items instead": my ideas list for this exchange, made on first use, attached, and returned.
// WHY a call of its own: the first item is added in a separate call, never in the same statement as the
// list (a STABLE policy cannot see a row written in the same statement).
export async function startExchangeIdeas(exchangeId: unknown): Promise<IdeasResult> {
  if (!isUuid(exchangeId)) return { ok: false, reason: "not-found" };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };
  const { data, error } = await supabase.rpc("use_exchange_ideas", { p_exchange: exchangeId });
  if (error || !data) return failureFor(error?.code);
  revalidateExchange(exchangeId);
  return { ok: true, listId: data };
}

// Add one idea. Returns the new item's id so the toast's Undo can take it back. Row Level Security
// allows the insert only into my own ideas list while I am an active member (migration exchange_lists).
export async function addIdeaItem(exchangeId: unknown, listId: unknown, input: unknown): Promise<AddIdeaResult> {
  if (!isUuid(exchangeId) || !isUuid(listId)) return { ok: false, reason: "not-found" };
  const parsed = validateItemInput(input);
  if (!parsed.ok) return { ok: false, reason: "invalid", errors: parsed.errors };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };

  const { name, link, priceKobo, priority, note } = parsed.value;
  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({ wishlist_id: listId, name, link, price_kobo: priceKobo, priority, note })
    .select("id")
    .single();
  // WHY 42501 is "not-found": RLS refuses an insert into a list that is not the caller's live ideas list.
  if (error || !data) return { ok: false, reason: error?.code === SIGNED_OUT ? "not-found" : "failed" };
  revalidateExchange(exchangeId);
  return { ok: true, id: data.id };
}

// Edit one idea. WHY not the wishlist action: this one refreshes the exchange's pages.
export async function updateIdeaItem(exchangeId: unknown, itemId: unknown, input: unknown): Promise<UpdateIdeaResult> {
  if (!isUuid(exchangeId) || !isUuid(itemId)) return { ok: false, reason: "not-found" };
  const parsed = validateItemInput(input);
  if (!parsed.ok) return { ok: false, reason: "invalid", errors: parsed.errors };
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, reason: "signed-out" };

  const { name, link, priceKobo, priority, note } = parsed.value;
  const { data, error } = await supabase
    .from("wishlist_items")
    .update({ name, link, price_kobo: priceKobo, priority, note })
    .eq("id", itemId)
    .select("id");
  if (error) return { ok: false, reason: "failed" };
  if (!data || data.length !== 1) return { ok: false, reason: "not-found" };
  revalidateExchange(exchangeId);
  return { ok: true };
}
