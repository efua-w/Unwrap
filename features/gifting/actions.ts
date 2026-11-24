"use server";

import { SIGNED_OUT } from "@/features/joining/status";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import { parseRecipientList } from "./format";
import type { RecipientList } from "./types";

// GC-015 the recipient's wishlist and the got-it marks. WHY ids only, and the caller read from the session by the database
// (plan §6 invariant 8): no user id is taken here, and every rule is the database's.

export type OpenListResult =
  | { ok: true; list: RecipientList }
  | { ok: false; reason: "signed-out" | "unavailable" | "failed" };

// The recipient's list, read from a Server Action called by a client component after the page mounts and only when this
// device has not hidden the person (GC-014, slice-10 AC-12). WHY never while the page renders: the person's name and items
// must not be in the page's HTML. WHY this call stamps the open time: it is open_recipient_list, which computes Updated from
// the previous open and then stamps (Q2), so it must not run for a hidden device or a second time for one view.
export async function openRecipientList(exchangeId: unknown): Promise<OpenListResult> {
  if (typeof exchangeId !== "string" || !isUuid(exchangeId)) return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  const { data, error } = await supabase.rpc("open_recipient_list", { p_exchange: exchangeId });
  if (error) return { ok: false, reason: error.code === SIGNED_OUT ? "signed-out" : "failed" };
  const row = data?.[0];
  // WHY "unavailable": no row means not a giver here, not revealed, or a closed exchange; the database says them all alike.
  if (!row) return { ok: false, reason: "unavailable" };
  const list = parseRecipientList(row);
  if (!list) return { ok: false, reason: "failed" };
  return { ok: true, list };
}

export type MarkResult = { ok: true } | { ok: false; reason: "signed-out" | "not-found" | "failed" };

const NOT_FOUND = "P0002";

// "I got this" / "I haven't got it after all". WHY P0002 is "not-found" and nothing more: the database gives the same answer
// for a reference that is not yours, an item that left the list and an exchange that has closed, and the screen must not say
// which (pair secrecy). Nothing here revalidates a page: a mark writes no activity and no email, and no other screen shows it.
export async function setGiftMark(exchangeId: unknown, ref: unknown, got: unknown): Promise<MarkResult> {
  if (typeof exchangeId !== "string" || !isUuid(exchangeId)) return { ok: false, reason: "not-found" };
  // WHY the length cap: a reference is 32 hex characters; anything else cannot be one.
  if (typeof ref !== "string" || !/^[0-9a-f]{32}$/.test(ref) || typeof got !== "boolean") return { ok: false, reason: "not-found" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  const { error } = await supabase.rpc("set_gift_mark", { p_exchange: exchangeId, p_ref: ref, p_got: got });
  if (error) {
    if (error.code === SIGNED_OUT) return { ok: false, reason: "signed-out" };
    if (error.code === NOT_FOUND) return { ok: false, reason: "not-found" };
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}
