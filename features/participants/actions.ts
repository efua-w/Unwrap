"use server";

import { revalidatePath } from "next/cache";
import { NOT_FOUND, REFUSED, SIGNED_OUT } from "@/features/joining/status";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";

// GCO-007 Approve, Decline and Remove. WHY an id of the request or the member and nothing else (plan §6
// invariant 8): the database reads the caller from the session and decides who may (organiser only, P0002
// for anyone else), so no user id and no exchange id is taken here. Every rule is the database's; this maps
// its answer to a line the screen can show.

export type DecideResult =
  | { ok: true }
  | { ok: false; reason: "signed-out" | "stale" | "full" | "ended" | "failed" };

type Failure = Extract<DecideResult, { ok: false }>;

// WHY decided and inactive are "stale": the list the organiser saw is out of date (another tab, or the
// person left), so the screen re-reads it. cancelled and closed mean the exchange moved on.
function refusal(hint: string | null): Failure["reason"] {
  switch (hint) {
    case "decided":
    case "inactive":
      return "stale";
    case "full":
      return "full";
    case "cancelled":
    case "closed":
      return "ended";
    default:
      return "failed";
  }
}

function failure(error: { code?: string; hint?: string | null }): Failure {
  if (error.code === SIGNED_OUT) return { ok: false, reason: "signed-out" };
  if (error.code === NOT_FOUND) return { ok: false, reason: "stale" };
  if (error.code === REFUSED) return { ok: false, reason: refusal(error.hint ?? null) };
  return { ok: false, reason: "failed" };
}

async function run(
  id: unknown,
  call: (supabase: Awaited<ReturnType<typeof createClient>>, id: string) => PromiseLike<{ error: { code?: string; hint?: string | null } | null }>,
): Promise<DecideResult> {
  if (typeof id !== "string" || !isUuid(id)) return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  const { error } = await call(supabase, id);
  if (error) return failure(error);
  // WHY the layout: the exchange page, Participants and Exchanges all show these people and requests.
  revalidatePath("/exchanges", "layout");
  return { ok: true };
}

export async function approveJoinRequest(requestId: unknown): Promise<DecideResult> {
  return run(requestId, (supabase, id) => supabase.rpc("approve_join_request", { p_request: id }));
}

export async function declineJoinRequest(requestId: unknown): Promise<DecideResult> {
  return run(requestId, (supabase, id) => supabase.rpc("decline_join_request", { p_request: id }));
}

export async function removeMember(memberId: unknown): Promise<DecideResult> {
  return run(memberId, (supabase, id) => supabase.rpc("remove_member", { p_member: id }));
}

// GCO-008 Nudge. WHY member ids and an exchange id and nothing else: the database reads the organiser from the session
// (P0002 for anyone else) and decides who is skipped (own row, list in, nudged in the last 12 hours), the 20 an hour
// limit and "before the draw". The result names only the people a nudge was queued for.
export type NudgeResult =
  | { ok: true; names: string[] }
  | { ok: false; reason: "signed-out" | "rate-limited" | "ended" | "failed" };

const MAX_NUDGE_PEOPLE = 100;
// WHY: send_nudge raises P0429 with the hint 'nudges' when the send would pass 20 emails in an hour.
const RATE_LIMITED = "P0429";

export async function sendNudge(exchangeId: unknown, memberIds: unknown): Promise<NudgeResult> {
  if (typeof exchangeId !== "string" || !isUuid(exchangeId)) return { ok: false, reason: "failed" };
  if (!Array.isArray(memberIds) || memberIds.length === 0 || memberIds.length > MAX_NUDGE_PEOPLE) return { ok: false, reason: "failed" };
  const ids: string[] = [];
  for (const id of memberIds) {
    if (typeof id !== "string" || !isUuid(id)) return { ok: false, reason: "failed" };
    ids.push(id);
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  const { data, error } = await supabase.rpc("send_nudge", { p_exchange: exchangeId, p_members: ids });
  if (error) {
    if (error.code === SIGNED_OUT) return { ok: false, reason: "signed-out" };
    if (error.code === RATE_LIMITED) return { ok: false, reason: "rate-limited" };
    if (error.code === REFUSED && (error.hint === "closed" || error.hint === "cancelled")) return { ok: false, reason: "ended" };
    return { ok: false, reason: "failed" };
  }
  revalidatePath("/exchanges", "layout");
  return { ok: true, names: (data ?? []).map((r) => r.display_name) };
}

export type UndoNudgeResult = { ok: true; stopped: number } | { ok: false; reason: "signed-out" | "failed" };

// WHY a count back: an email already on its way cannot be stopped, and the toast says so (never promise an undo
// that did not happen).
export async function undoNudge(exchangeId: unknown): Promise<UndoNudgeResult> {
  if (typeof exchangeId !== "string" || !isUuid(exchangeId)) return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  const { data, error } = await supabase.rpc("undo_nudge", { p_exchange: exchangeId });
  if (error) return { ok: false, reason: error.code === SIGNED_OUT ? "signed-out" : "failed" };
  revalidatePath("/exchanges", "layout");
  return { ok: true, stopped: data ?? 0 };
}
