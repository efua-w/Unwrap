import "server-only";
import { fromView } from "@/features/exchanges/queries";
import { listMyWishlists } from "@/features/wishlists/queries";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import { parseMyExchangeList } from "./parse";
import type { ExchangeListContext, MyExchangeList, MyIdeas, OwnerWishlistSummary } from "./types";

// Reads for Attach list (S11, S49) and You're in (S12). Every read runs under the signed-in person's
// Row Level Security; nothing here takes a user id from the client. The exchange is read through
// exchanges_visible, so the invite token is out by construction.

// One exchange for one of its active members, or null. WHY one answer for every refusal: a missing,
// cancelled, someone else's or already-drawn exchange all give the same "isn't available to you" page
// (GC-029). Only open and joining-closed exchanges can be attached to before the draw; slice 11 widens it.
export async function getExchangeForList(id: string, viewerId: string): Promise<ExchangeListContext | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data: viewRow, error } = await supabase.from("exchanges_visible").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not read the exchange.");
  const row = viewRow ? fromView(viewRow) : null;
  if (!row || row.cancelled) return null;

  const [member, state] = await Promise.all([
    supabase
      .from("exchange_members")
      .select("taking_part")
      .eq("exchange_id", id)
      .eq("user_id", viewerId)
      .eq("state", "active")
      .maybeSingle(),
    supabase.rpc("exchange_state", { p_exchange: id }),
  ]);
  if (member.error || state.error) throw new Error("Could not read the exchange.");
  if (!member.data) return null;
  if (state.data !== "open" && state.data !== "joining_closed") return null;

  // WHY only for organiser-draws: step 1 of You're in names who will draw. The name comes from
  // get_exchange_people, which answers active members only and gives names, never emails.
  let organiserName: string | null = null;
  if (row.drawMode === "organiser_chooses" && row.organiserId !== viewerId) {
    const people = await supabase.rpc("get_exchange_people", { p_exchange: id });
    if (people.error) throw new Error("Could not read the exchange.");
    organiserName = people.data.find((p) => p.is_organiser)?.display_name ?? null;
  }

  return {
    id: row.id,
    name: row.name,
    tint: row.tint,
    budget: row.budget,
    joinByAt: row.joinByAt,
    drawMode: row.drawMode,
    drawAt: row.drawAt,
    giftDay: row.giftDay,
    approvalRequired: row.approvalRequired,
    isOrganiser: row.organiserId === viewerId,
    takingPart: member.data.taking_part,
    organiserName,
  };
}

// The caller's own list in this exchange (GC-010). Null only when the answer is unreadable.
export async function getMyExchangeList(id: string): Promise<MyExchangeList | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_exchange_list", { p_exchange: id });
  if (error) throw new Error("Could not read your list.");
  return parseMyExchangeList(data);
}

// The caller's ideas for this exchange, attached or kept hidden behind a wishlist (GC-010). WHY the
// owner filter as well as Row Level Security: the query states whose list it means.
export async function getMyIdeas(exchangeId: string, viewerId: string): Promise<MyIdeas> {
  const supabase = await createClient();
  const { data: list, error } = await supabase
    .from("wishlists")
    .select("id")
    .eq("kind", "exchange_ideas")
    .eq("exchange_id", exchangeId)
    .eq("owner_id", viewerId)
    .maybeSingle();
  if (error) throw new Error("Could not read your ideas.");
  if (!list) return { listId: null, items: [] };

  const { data: items, error: itemsError } = await supabase
    .from("wishlist_items")
    .select("id, name, link, price_kobo, priority, note, updated_at")
    .eq("wishlist_id", list.id)
    .order("updated_at", { ascending: false });
  if (itemsError) throw new Error("Could not read your ideas.");
  return {
    listId: list.id,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      link: item.link,
      priceKobo: item.price_kobo,
      priority: item.priority,
      note: item.note,
      updatedAt: item.updated_at,
    })),
  };
}

// The person's own personal lists, for the picker and the current row. Ideas lists never appear.
export async function getMyPersonalLists(): Promise<OwnerWishlistSummary[]> {
  return listMyWishlists();
}
