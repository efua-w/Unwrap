import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import { toJoinRequestRow, toJoinRequestRowWithEmail, toParticipantLine } from "./map";
import type { MyPendingRequest, JoinRequestRow, JoinRequestRowWithEmail, ParticipantLine, ReadinessRow } from "./types";

// Reads for Participants, the request blocks and the asker's pending rows (GCO-007, GC-012). Every one is
// a narrow database function. WHY mapped field by field: an email or a user id cannot be added to a screen
// by a `select *` (AC-41). The email is mapped in exactly two places, both Participants-only (owner decision
// 2026-11-15); every other reader gets the names-only shape.

// The organiser's pending requests, names only, oldest first (the exchange page and Exchanges). WHY the email
// the database now returns is dropped here: those pages have no use for it, so it never reaches their props.
// The database gives a non-organiser an empty answer, so a
// member's page never learns that requests exist (AC-42).
export async function getJoinRequests(exchangeId: string): Promise<JoinRequestRow[]> {
  if (!isUuid(exchangeId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_join_requests", { p_exchange: exchangeId });
  if (error) throw new Error("Could not read the join requests.");
  return data.map(toJoinRequestRow);
}

// The same requests with each requester's address, for Participants only (GCO-007, owner decision 2026-11-15).
export async function getJoinRequestsWithEmail(exchangeId: string): Promise<JoinRequestRowWithEmail[]> {
  if (!isUuid(exchangeId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_join_requests", { p_exchange: exchangeId });
  if (error) throw new Error("Could not read the join requests.");
  return data.map(toJoinRequestRowWithEmail);
}

// Everyone taking part, organiser first, with their address (null on the organiser's own row) and whether a
// list is attached. Participants only. WHY the filter is here and taking_part goes no further: the people
// list says who is taking part, and the flag is not needed past this line (an organiser who only organises
// is not one of them).
export async function getParticipants(exchangeId: string): Promise<ParticipantLine[]> {
  if (!isUuid(exchangeId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_participants", { p_exchange: exchangeId });
  if (error) throw new Error("Could not read the participants.");
  return data
    .filter((p) => p.taking_part)
    .map(toParticipantLine);
}

// Who is taking part and whether each has a wishlist in, for the organiser only (GCO-006). The database answers
// anyone else with no rows, so a member's page never learns the numbers. Names and yes or no, nothing else.
export async function getReadiness(exchangeId: string): Promise<ReadinessRow[]> {
  if (!isUuid(exchangeId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_readiness", { p_exchange: exchangeId });
  if (error || !data) throw new Error("Could not read the readiness.");
  return data.map((r) => ({
    memberId: r.member_id,
    name: r.display_name,
    isMe: r.is_me,
    hasWishlist: r.has_wishlist,
    nudgedRecently: r.nudged_recently,
  }));
}

// The signed-in person's own requests, oldest first (S08 Exchanges, GC-012, GC-006): the ones still waiting, and the ones
// the draw closed until their asker dismisses them (owner Q5, 2026-11-22). A declined one disappears silently (owner Q8).
export async function listMyPendingRequests(): Promise<MyPendingRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_join_requests");
  if (error) throw new Error("Could not read your requests.");
  return data
    .flatMap((r) => (r.status === "pending" || r.status === "closed" ? [{ ...r, status: r.status }] : []))
    .map((r) => ({
      requestId: r.request_id,
      status: r.status,
      exchangeName: r.exchange_name,
      exchangeTint: r.exchange_tint,
      organiserName: r.organiser_name,
      requestedAt: r.requested_at,
    }));
}

// Owner Q15: the exchange's name, and only for a person the organiser removed. Null for everyone else,
// including a bad id, so the page falls back to "isn't available to you" (S47).
export async function getRemovedExchangeName(exchangeId: string): Promise<string | null> {
  if (!isUuid(exchangeId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_removed_exchange_name", { p_exchange: exchangeId });
  if (error) throw new Error("Could not read the exchange.");
  return data ?? null;
}
