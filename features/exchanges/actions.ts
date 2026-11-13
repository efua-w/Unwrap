"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
