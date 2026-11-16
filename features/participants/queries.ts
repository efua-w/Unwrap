import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import type { MyPendingRequest, JoinRequestRow, ParticipantLine } from "./types";

// Reads for Participants, the request blocks and the asker's pending rows (GCO-007, GC-012). Every one is
// a narrow database function that returns names, ids of the request or member, and times. WHY mapped field
// by field: an email, a user id or a list status cannot be added to a screen by a `select *` (AC-41).

// The organiser's pending requests, oldest first. The database gives a non-organiser an empty answer, so a
// member's page never learns that requests exist (AC-42).
export async function getJoinRequests(exchangeId: string): Promise<JoinRequestRow[]> {
  if (!isUuid(exchangeId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_join_requests", { p_exchange: exchangeId });
  if (error) throw new Error("Could not read the join requests.");
  return data.map((r) => ({ requestId: r.request_id, name: r.display_name, requestedAt: r.requested_at }));
}

// Everyone taking part, organiser first. WHY the filter is here and taking_part goes no further: the people
// list says who is taking part, and the flag is not needed past this line (an organiser who only organises
// is not one of them).
export async function getParticipants(exchangeId: string): Promise<ParticipantLine[]> {
  if (!isUuid(exchangeId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_participants", { p_exchange: exchangeId });
  if (error) throw new Error("Could not read the participants.");
  return data
    .filter((p) => p.taking_part)
    .map((p) => ({ memberId: p.member_id, name: p.display_name, isMe: p.is_me, isOrganiser: p.is_organiser }));
}

// The signed-in person's own pending requests, oldest first (S08 Exchanges, GC-012). Only requests still
// waiting come back: a declined one disappears silently (owner Q8).
export async function listMyPendingRequests(): Promise<MyPendingRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_join_requests");
  if (error) throw new Error("Could not read your requests.");
  return data
    .filter((r) => r.status === "pending")
    .map((r) => ({
      requestId: r.request_id,
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
