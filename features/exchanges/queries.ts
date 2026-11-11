import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import type { ExchangeListItem, OrganiserExchange } from "./types";

// Reads for Exchanges and the exchange page (GC-008, GC-013, GCO-004). Every query runs under the
// signed-in person's Row Level Security, which already limits rows to exchanges they are in. WHY the
// columns are listed: the table's column grants refuse `select *` (invite_token is not readable by
// anyone through the API), and naming them keeps anything else from reaching a page by accident.
const EXCHANGE_COLUMNS =
  "id, organiser_id, name, note, budget_preset, join_by_at, draw_mode, draw_at, event_at, approval_required, tint, created_at, cancelled_at, completed_at";

// WHY P0002: get_exchange_invite_token raises no_data_found for "not the organiser", "no such
// exchange" and an outsider alike (migration 20261109104934_exchanges).
const NOT_FOUND = "P0002";

// My exchanges, newest first. People are a count and "do I take part" only: names and who gives to
// whom are never read here (pair secrecy; the organiser never reads assignments).
export async function listMyExchanges(viewerId: string): Promise<ExchangeListItem[]> {
  const supabase = await createClient();
  const { data: exchanges, error } = await supabase
    .from("exchanges")
    .select(EXCHANGE_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not read exchanges.");
  if (exchanges.length === 0) return [];

  const { data: members, error: membersError } = await supabase
    .from("exchange_members")
    .select("exchange_id, user_id, taking_part")
    .eq("state", "active");
  if (membersError) throw new Error("Could not read exchanges.");

  return exchanges.map((row) => {
    const inIt = members.filter((m) => m.exchange_id === row.id);
    return {
      id: row.id,
      name: row.name,
      tint: row.tint,
      joinByAt: row.join_by_at,
      drawMode: row.draw_mode,
      drawAt: row.draw_at,
      eventAt: row.event_at,
      approvalRequired: row.approval_required,
      isOrganiser: row.organiser_id === viewerId,
      takingPart: inIt.find((m) => m.user_id === viewerId)?.taking_part ?? false,
      peopleCount: inIt.length,
      createdAt: row.created_at,
      isPast: row.cancelled_at !== null || row.completed_at !== null,
    };
  });
}

// WHY the token sits beside `exchange`, not inside OrganiserExchange: only the organiser's page
// receives it, to build the invite link (GCO-004). The list and view types never carry it.
export type OrganiserExchangeDetail = { exchange: OrganiserExchange; inviteToken: string };

// One exchange for its organiser, or null when it is missing, cancelled, someone else's, or the
// viewer is only a member. WHY one answer for all of them: the page says "This exchange isn't
// available to you" without confirming the exchange exists (GC-029, S47).
export async function getOrganiserExchange(id: string, viewerId: string): Promise<OrganiserExchangeDetail | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("exchanges").select(EXCHANGE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not read the exchange.");
  // WHY cancelled is "not available": cancelling arrives in slice 15, and get_exchange_invite_token
  // does not refuse a cancelled exchange yet (progress open item).
  if (!row || row.organiser_id !== viewerId || row.cancelled_at !== null) return null;

  const [members, state, token] = await Promise.all([
    supabase.from("exchange_members").select("user_id, taking_part").eq("exchange_id", id).eq("state", "active"),
    supabase.rpc("exchange_state", { p_exchange: id }),
    supabase.rpc("get_exchange_invite_token", { p_exchange: id }),
  ]);
  if (members.error || state.error) throw new Error("Could not read the exchange.");
  if (token.error) {
    if (token.error.code === NOT_FOUND) return null;
    throw new Error("Could not read the invite link.");
  }

  return {
    inviteToken: token.data,
    exchange: {
      id: row.id,
      name: row.name,
      note: row.note,
      budget: row.budget_preset,
      tint: row.tint,
      joinByAt: row.join_by_at,
      drawMode: row.draw_mode,
      drawAt: row.draw_at,
      eventAt: row.event_at,
      approvalRequired: row.approval_required,
      takingPart: members.data.find((m) => m.user_id === viewerId)?.taking_part ?? false,
      peopleCount: members.data.length,
      createdAt: row.created_at,
      isOpen: state.data === "open",
    },
  };
}
