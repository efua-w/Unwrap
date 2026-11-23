"use server";

import { revalidatePath } from "next/cache";
import { REFUSED, SIGNED_OUT } from "@/features/joining/status";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import { parseRecipient } from "./format";
import type { Recipient } from "./types";

// GCO-011 Draw names, GC-014 Reveal and GC-006 Dismiss. WHY ids only, and the caller read from the session by the
// database (plan §6 invariant 8): no user id is taken here, and every rule is the database's.

// few         fewer than 3 people take part now: the sheet was out of date
// exclusions  no fair draw exists with the pairs as they are
// ended        the exchange is cancelled or over
// failed       anything else: nothing was drawn, so Try again is safe
export type DrawResult =
  | { ok: true }
  | { ok: false; reason: "signed-out" | "few" | "exclusions" | "ended" | "failed" };

export async function drawNames(exchangeId: unknown): Promise<DrawResult> {
  if (typeof exchangeId !== "string" || !isUuid(exchangeId)) return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  const { data, error } = await supabase.rpc("draw_names", { p_exchange: exchangeId });
  if (error) {
    if (error.code === SIGNED_OUT) return { ok: false, reason: "signed-out" };
    if (error.code === REFUSED && error.hint === "few") return { ok: false, reason: "few" };
    if (error.code === REFUSED && error.hint === "exclusions") return { ok: false, reason: "exclusions" };
    if (error.code === REFUSED && (error.hint === "cancelled" || error.hint === "closed")) return { ok: false, reason: "ended" };
    return { ok: false, reason: "failed" };
  }
  if (!data || data.length === 0) return { ok: false, reason: "failed" };
  // WHY the layout: the exchange page, Exchanges, Activity and the tab badge all change with the draw.
  revalidatePath("/", "layout");
  return { ok: true };
}

// The reveal tap (GC-014). WHY the recipient is read here, from a Server Action called by a client component after the
// person asks, and never while the page renders (AC-12): the page's HTML must not contain the name. WHY read before
// stamping: if the stamp fails, nothing is returned, so "Nothing was revealed" is true.
export type RevealResult = { ok: true; recipient: Recipient } | { ok: false; reason: "signed-out" | "unavailable" | "failed" };

async function readRecipient(exchangeId: string, stamp: boolean): Promise<RevealResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  if (!stamp) {
    // WHY: loadRecipient shows the person without the first-reveal stamp, so it refuses unless the database says this
    // giver has already revealed. A direct call can then not skip the privacy check (GC-014, review R1-6).
    const mine = await supabase.rpc("get_my_assignment", { p_exchange: exchangeId });
    if (mine.error) return { ok: false, reason: mine.error.code === SIGNED_OUT ? "signed-out" : "failed" };
    if (!mine.data?.[0]?.revealed) return { ok: false, reason: "unavailable" };
  }
  const { data, error } = await supabase.rpc("get_my_recipient", { p_exchange: exchangeId });
  if (error) return { ok: false, reason: error.code === SIGNED_OUT ? "signed-out" : "failed" };
  const row = data?.[0];
  // WHY "unavailable": no row means this person gives to nobody here (a replaced assignment, or never a giver).
  if (!row) return { ok: false, reason: "unavailable" };
  const recipient = parseRecipient(row);
  if (!recipient) return { ok: false, reason: "failed" };
  if (stamp) {
    const marked = await supabase.rpc("mark_assignment_revealed", { p_exchange: exchangeId });
    if (marked.error) return { ok: false, reason: marked.error.code === "P0002" ? "unavailable" : "failed" };
    // WHY: the exchange page and Exchanges stop asking for the reveal once it happened.
    revalidatePath("/", "layout");
  }
  return { ok: true, recipient };
}

// First reveal (or revealing again after Hide again): stamps the time once and returns the person.
export async function revealRecipient(exchangeId: unknown): Promise<RevealResult> {
  if (typeof exchangeId !== "string" || !isUuid(exchangeId)) return { ok: false, reason: "failed" };
  return readRecipient(exchangeId, true);
}

// Already revealed on another device or earlier on this one, and not hidden here: show the person without stamping.
export async function loadRecipient(exchangeId: unknown): Promise<RevealResult> {
  if (typeof exchangeId !== "string" || !isUuid(exchangeId)) return { ok: false, reason: "failed" };
  return readRecipient(exchangeId, false);
}

export type DismissResult = { ok: true } | { ok: false; reason: "signed-out" | "failed" };

// GC-006: the asker clears a request the draw closed.
export async function dismissRequest(requestId: unknown): Promise<DismissResult> {
  if (typeof requestId !== "string" || !isUuid(requestId)) return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  const { error } = await supabase.rpc("dismiss_join_request", { p_id: requestId });
  if (error) return { ok: false, reason: error.code === SIGNED_OUT ? "signed-out" : "failed" };
  revalidatePath("/exchanges", "layout");
  return { ok: true };
}
