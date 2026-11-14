"use server";

import { createClient } from "@/lib/supabase/server";
import { getJoinDetails } from "./queries";
import { NOT_FOUND, REFUSED, refusalFromHint, type JoinRefusal } from "./status";

// GC-009 Join exchange. WHY the token and nothing else (plan §6 invariant 8): no exchange id and no user
// id is accepted. join_exchange reads the caller from the session and the exchange from the token, and
// makes every rule decision (closed, full, removed, approval) itself. This only maps its answer.

export type JoinResult =
  | { ok: true; exchangeId: string }
  | { ok: false; reason: "refused"; refusal: JoinRefusal }
  | { ok: false; reason: "incorrect" | "signed-out" | "failed" };

const TOKEN = /^[0-9a-f]{32}$/;
const SIGNED_OUT = "42501";

export async function joinExchange(token: unknown): Promise<JoinResult> {
  if (typeof token !== "string" || !TOKEN.test(token)) return { ok: false, reason: "incorrect" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };

  const { data, error } = await supabase.rpc("join_exchange", { p_token: token });
  if (error || !data) {
    if (error?.code === NOT_FOUND) return { ok: false, reason: "incorrect" };
    if (error?.code === SIGNED_OUT) return { ok: false, reason: "signed-out" };
    if (error?.code === REFUSED) {
      const refusal = refusalFromHint(error.hint);
      if (refusal) return { ok: false, reason: "refused", refusal };
    }
    return { ok: false, reason: "failed" };
  }
  // WHY a second read: join_exchange answers with the membership's id, not the exchange's, so the exchange
  // is read back through get_join_details, which gives its id to an active member only (found by the e2e
  // run, 2026-11-14: the redirect had used the membership id).
  try {
    const details = await getJoinDetails(token);
    if (details?.exchangeId) return { ok: true, exchangeId: details.exchangeId };
  } catch {
    // Falls through: the person is in, but the page cannot say where; Try again is safe (join is idempotent).
  }
  return { ok: false, reason: "failed" };
}
