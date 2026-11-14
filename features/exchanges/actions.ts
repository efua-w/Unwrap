"use server";

import { revalidatePath } from "next/cache";
import { buildInviteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import { fieldFromHint, parseExchangeInput, type ErrorCode, type ExchangeErrors, type FieldKey } from "@/lib/validation/exchange";

// Server Action for Start exchange (GCO-001..003). It validates its input, never takes a user id
// (create_exchange reads the caller from the session), and returns a result instead of throwing.
// Authorisation and every rule that needs the clock are the database's (plan §6); this does not
// repeat them.

export type CreateExchangeResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid"; errors: ExchangeErrors }
  | { ok: false; reason: "signed-out" | "failed" };

// WHY 22023: create_exchange refuses bad input with invalid_parameter_value and the field as the hint.
const INVALID_PARAMETER = "22023";

export async function createExchange(input: unknown): Promise<CreateExchangeResult> {
  const parsed = parseExchangeInput(input);
  if (!parsed.ok) {
    return Object.keys(parsed.errors).length > 0 ? { ok: false, reason: "invalid", errors: parsed.errors } : { ok: false, reason: "failed" };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };

  const v = parsed.value;
  const { data, error } = await supabase.rpc("create_exchange", {
    p_name: v.name,
    p_note: v.note ?? "",
    p_budget: v.budget,
    p_join_by_date: v.joinByDate,
    p_draw_mode: v.drawMode,
    p_draw_time: v.drawTime,
    p_gift_day: v.giftDay,
    p_time_zone: v.timeZone,
    p_taking_part: v.takingPart,
    p_approval_required: v.approvalRequired,
  });
  if (error || !data) {
    if (error?.code === INVALID_PARAMETER) {
      const mapped = fieldFromHint(error.hint, v);
      if (mapped) {
        const field: FieldKey = mapped.field;
        const code: ErrorCode = mapped.code;
        return { ok: false, reason: "invalid", errors: { [field]: code } };
      }
    }
    return { ok: false, reason: "failed" };
  }
  revalidatePath("/exchanges");
  return { ok: true, id: data };
}

export type ResetInviteResult =
  | { ok: true; inviteUrl: string }
  | { ok: false; reason: "signed-out" | "ended" | "failed" };

// GCO-005 Reset link. The database decides who may (reset_invite_token: organiser only, P0002 for anyone
// else) and refuses a cancelled or complete exchange (22023). WHY the new link is built here and returned:
// it is made from SITE_URL on the server, and goes only to the organiser who asked (token stays
// organiser-only, AC-5).
export async function resetInviteLink(exchangeId: string): Promise<ResetInviteResult> {
  if (!isUuid(exchangeId)) return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };
  const { data, error } = await supabase.rpc("reset_invite_token", { p_exchange: exchangeId });
  if (error || !data) return { ok: false, reason: error?.code === INVALID_PARAMETER ? "ended" : "failed" };
  revalidatePath(`/exchanges/${exchangeId}`);
  return { ok: true, inviteUrl: await buildInviteUrl(data) };
}
