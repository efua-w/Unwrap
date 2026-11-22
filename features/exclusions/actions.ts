"use server";

import { revalidatePath } from "next/cache";
import { REFUSED, SIGNED_OUT } from "@/features/joining/status";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import { checkExclusions } from "./queries";
import type { PairCheck } from "./types";

// GCO-009 check and save. WHY ids only, and the organiser read from the session by the database (plan §6
// invariant 8): no user id is taken here, and the database answers anyone but the organiser with nothing (check) or
// P0002 (save). Every rule is the database's; this maps its answer to a line the screen can show.

// The database's own cap (private.assert_pairs_shape), so a bad draft is refused here without a round trip.
const MAX_PAIRS = 200;

type Ids = { first: string[]; second: string[] };

function parseIds(first: unknown, second: unknown): Ids | null {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length || first.length > MAX_PAIRS) return null;
  const a: string[] = [];
  const b: string[] = [];
  for (let i = 0; i < first.length; i++) {
    const x: unknown = first[i];
    const y: unknown = second[i];
    if (typeof x !== "string" || typeof y !== "string" || !isUuid(x) || !isUuid(y) || x === y) return null;
    a.push(x);
    b.push(y);
  }
  return { first: a, second: b };
}

export type CheckResult = { ok: true; check: PairCheck } | { ok: false; reason: "signed-out" | "failed" };

export async function checkPairs(exchangeId: unknown, first: unknown, second: unknown): Promise<CheckResult> {
  const ids = parseIds(first, second);
  if (typeof exchangeId !== "string" || !isUuid(exchangeId) || !ids) return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  try {
    const check = await checkExclusions(exchangeId, ids.first, ids.second);
    return check ? { ok: true, check } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

// stale   someone in the draft is no longer taking part: the list on screen is out of date, so the page re-reads it
// locked  the exchange is past joining or cancelled: the pairs can no longer change
export type SaveResult = { ok: true } | { ok: false; reason: "signed-out" | "stale" | "locked" | "failed" };

export async function savePairs(exchangeId: unknown, first: unknown, second: unknown): Promise<SaveResult> {
  const ids = parseIds(first, second);
  if (typeof exchangeId !== "string" || !isUuid(exchangeId) || !ids) return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  const { error } = await supabase.rpc("save_exclusions", { p_exchange: exchangeId, p_first: ids.first, p_second: ids.second });
  if (error) {
    if (error.code === SIGNED_OUT) return { ok: false, reason: "signed-out" };
    if (error.code === REFUSED && error.hint === "members") return { ok: false, reason: "stale" };
    if (error.code === REFUSED && (error.hint === "closed" || error.hint === "cancelled")) return { ok: false, reason: "locked" };
    return { ok: false, reason: "failed" };
  }
  // WHY the layout: the exchange page's Organiser tools row shows the pair count.
  revalidatePath("/exchanges", "layout");
  return { ok: true };
}
