import "server-only";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import type { ExchangeListItem, OrganiserExchange } from "./types";

// Reads for Exchanges and the exchange page (GC-008, GC-013, GCO-004). Every query runs under the
// signed-in person's Row Level Security, which already limits rows to exchanges they are in.
// WHY public.exchanges_visible and `select *` (audit finding 6, 2026-11-13): the view lists exactly the
// columns signed-in people may read, so the invite token is out by construction and no column string
// here has to match the grants. pgTAP 140 fails if the view and the grants ever disagree.
type VisibleRow = Database["public"]["Views"]["exchanges_visible"]["Row"];

// WHY: Postgres reports every view column as nullable, but these are NOT NULL columns of
// public.exchanges seen through a plain projection. A null here means the view is broken, so it fails
// loudly instead of rendering a half-empty exchange.
function fromView(row: VisibleRow) {
  const { id, organiser_id, name, budget_preset, join_by_at, draw_mode, gift_day, approval_required, tint, created_at } = row;
  if (
    id === null || organiser_id === null || name === null || budget_preset === null || join_by_at === null ||
    draw_mode === null || gift_day === null || approval_required === null || tint === null || created_at === null
  ) {
    throw new Error("exchanges_visible returned an incomplete row.");
  }
  return {
    id, organiserId: organiser_id, name, note: row.note, budget: budget_preset, joinByAt: join_by_at, drawMode: draw_mode,
    drawAt: row.draw_at, giftDay: gift_day, approvalRequired: approval_required, tint, createdAt: created_at,
    isPast: row.cancelled_at !== null || row.completed_at !== null, cancelled: row.cancelled_at !== null,
  };
}

// WHY P0002: get_exchange_invite_token raises no_data_found for "not the organiser", "no such
// exchange" and an outsider alike (migration 20261109104934_exchanges).
const NOT_FOUND = "P0002";

// My exchanges, newest first. People are a count and "do I take part" only: names and who gives to
// whom are never read here (pair secrecy; the organiser never reads assignments).
// WHY the members are embedded per exchange (audit finding 2, 2026-11-13): one separate read of every
// membership row the viewer can see stopped at the API's 1,000-row limit, silently giving wrong counts
// to a person in many exchanges. Embedded, each exchange brings only its own active members (at most
// 100, the exchange size limit). WHY not `exchange_members(count)`: it runs count(*), which needs a
// table-wide grant, and exchange_members has column grants only.
export async function listMyExchanges(viewerId: string): Promise<ExchangeListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchanges_visible")
    .select("*, people:exchange_members(user_id, taking_part)")
    .eq("people.state", "active")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not read exchanges.");

  return data.map((row) => {
    const exchange = fromView(row);
    return {
      id: exchange.id,
      name: exchange.name,
      tint: exchange.tint,
      joinByAt: exchange.joinByAt,
      drawMode: exchange.drawMode,
      drawAt: exchange.drawAt,
      giftDay: exchange.giftDay,
      approvalRequired: exchange.approvalRequired,
      isOrganiser: exchange.organiserId === viewerId,
      takingPart: row.people.find((m) => m.user_id === viewerId)?.taking_part ?? false,
      peopleCount: row.people.length,
      createdAt: exchange.createdAt,
      isPast: exchange.isPast,
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
  const { data: viewRow, error } = await supabase.from("exchanges_visible").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not read the exchange.");
  const row = viewRow ? fromView(viewRow) : null;
  // WHY cancelled is "not available": cancelling arrives in slice 15, and get_exchange_invite_token
  // does not refuse a cancelled exchange yet (progress open item).
  if (!row || row.organiserId !== viewerId || row.cancelled) return null;

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
      budget: row.budget,
      tint: row.tint,
      joinByAt: row.joinByAt,
      drawMode: row.drawMode,
      drawAt: row.drawAt,
      giftDay: row.giftDay,
      approvalRequired: row.approvalRequired,
      takingPart: members.data.find((m) => m.user_id === viewerId)?.taking_part ?? false,
      peopleCount: members.data.length,
      createdAt: row.createdAt,
      isOpen: state.data === "open",
    },
  };
}
