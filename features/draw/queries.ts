import "server-only";
import { fromView } from "@/features/exchanges/queries";
import type { BudgetPreset } from "@/lib/money/budget";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import { parseAssignment, parseSummary } from "./format";
import type { DrawSummary, MyAssignment } from "./types";

// Reads for the draw (GCO-012, GC-013, GC-014). Each is a narrow database function. WHY mapped by a strict parser: the
// organiser's answer is a count and a moment, the giver's is an id and a flag, and neither can carry a person.

// The organiser's read of the current draw, or null when there is none or the caller is not the organiser (the
// database gives both the same empty answer).
export async function getDrawSummary(exchangeId: string): Promise<DrawSummary | null> {
  if (!isUuid(exchangeId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_draw_summary", { p_exchange: exchangeId });
  if (error || !data) throw new Error("Could not read the draw.");
  const row = data[0];
  if (!row) return null;
  const parsed = parseSummary(row);
  if (!parsed) throw new Error("Could not read the draw.");
  return parsed;
}

// The caller's own current assignment, or null for everyone who gives to nobody here (an organiser who only organises,
// a requester, an outsider). It holds no name: the reveal page fetches that after the person asks.
export async function getMyAssignment(exchangeId: string): Promise<MyAssignment | null> {
  if (!isUuid(exchangeId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_assignment", { p_exchange: exchangeId });
  if (error || !data) throw new Error("Could not read your assignment.");
  const row = data[0];
  if (!row) return null;
  const parsed = parseAssignment(row);
  if (!parsed) throw new Error("Could not read your assignment.");
  return parsed;
}

// What Reveal prints around the person: the exchange's name, budget and gift day. The page is for a giver whose exchange
// is drawn (or whose gift day has passed): a cancelled, missing or not-yet-drawn exchange gives null, which shows S47.
// WHY the state is read here and not assumed from the assignment: a cancelled exchange keeps its assignment rows.
export type RevealExchange = { name: string; budget: BudgetPreset; giftDay: string };

export async function getRevealExchange(exchangeId: string): Promise<RevealExchange | null> {
  if (!isUuid(exchangeId)) return null;
  const supabase = await createClient();
  const [view, state] = await Promise.all([
    supabase.from("exchanges_visible").select("*").eq("id", exchangeId).maybeSingle(),
    supabase.rpc("exchange_state", { p_exchange: exchangeId }),
  ]);
  if (view.error || state.error) throw new Error("Could not read the exchange.");
  if (!view.data || (state.data !== "drawn" && state.data !== "event_passed")) return null;
  const row = fromView(view.data);
  return { name: row.name, budget: row.budget, giftDay: row.giftDay };
}
