import "server-only";
import { firstName } from "@/features/joining/copy";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import type { DraftPair, PairCheck } from "./types";

// Reads for Exclusions (GCO-009). Each is a narrow database function that answers the organiser only: anyone else
// gets no rows, so a member's page never learns that pairs exist. WHY mapped field by field: nothing but member ids
// and first names can reach a screen.

// The saved pairs, oldest first, so the last one is the most recently added.
export async function getExclusions(exchangeId: string): Promise<DraftPair[]> {
  if (!isUuid(exchangeId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_exclusions", { p_exchange: exchangeId });
  if (error) throw new Error("Could not read the pairs.");
  return data.map((r) => ({ firstId: r.first_member_id, firstName: firstName(r.first_name), secondId: r.second_member_id, secondName: firstName(r.second_name) }));
}

// Judges a draft (the whole list as it would be saved). Null when the database answers no row: not the organiser.
export async function checkExclusions(exchangeId: string, first: readonly string[], second: readonly string[]): Promise<PairCheck | null> {
  if (!isUuid(exchangeId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_exclusions", { p_exchange: exchangeId, p_first: [...first], p_second: [...second] });
  if (error) throw new Error("Could not check the pairs.");
  const row = data[0];
  if (!row) return null;
  return {
    peopleCount: row.people_count,
    feasible: row.feasible,
    // WHY both ids or neither: the database sends null for both when no single pair fixes the draw.
    relax: row.relax_first && row.relax_second ? { firstId: row.relax_first, secondId: row.relax_second } : null,
  };
}
