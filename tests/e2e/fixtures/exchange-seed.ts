import { adminClient, createTestUser, deleteTestUser, uniqueEmail } from "./auth";
import { wallClockIn } from "../../../lib/dates/format";

// Service-role seeding shared by the slice 6 specs (approval, Participants, Activity). WHY the service
// role: the specs under test are the request, Participants and Activity screens, not Start an exchange
// (slice 4's spec covers that), and a few states (join-by passed, thirty-odd events) have no UI route.

export const ZONE = "Africa/Lagos";

export function ymdIn(days: number): string {
  return wallClockIn(new Date(Date.now() + days * 86_400_000), ZONE).ymd;
}

export const JOIN_AT = `${ymdIn(10)}T17:00:00Z`; // 6:00 pm in Lagos
export const GIFT = ymdIn(20);

export type Person = { id: string; email: string; first: string };
export type Seeded = { id: string; token: string; name: string };

// Everyone a spec creates, deleted by cleanup() in afterEach.
export function people() {
  const created: string[] = [];
  return {
    async newPerson(first: string): Promise<Person> {
      const email = uniqueEmail(first.toLowerCase());
      const id = await createTestUser(email, first, true, true);
      created.push(email);
      return { id, email, first };
    },
    async cleanup() {
      for (const email of created.splice(0)) await deleteTestUser(email);
    },
  };
}

export async function seedExchange(
  organiser: Person,
  name: string,
  options: { approval?: boolean; manual?: boolean; takingPart?: boolean } = {},
): Promise<Seeded> {
  const { approval = false, manual = true, takingPart = true } = options;
  const db = adminClient();
  const { data, error } = await db
    .from("exchanges")
    .insert({
      organiser_id: organiser.id,
      name,
      note: "Gifts after the carol service.",
      budget_preset: "5k_10k",
      join_by_at: JOIN_AT,
      draw_mode: manual ? "organiser_chooses" : "at_join_by",
      draw_at: manual ? null : JOIN_AT,
      gift_day: GIFT,
      organiser_tz: ZONE,
      tint: "mint",
      approval_required: approval,
    })
    .select("id, invite_token")
    .single();
  if (error || !data) throw new Error(`seedExchange failed: ${error?.message}`);
  const member = await db.from("exchange_members").insert({ exchange_id: data.id, user_id: organiser.id, taking_part: takingPart });
  if (member.error) throw new Error(`seedExchange member failed: ${member.error.message}`);
  return { id: data.id, token: data.invite_token, name };
}

export async function addMember(exchangeId: string, person: Person, state: "active" | "left" | "removed" = "active") {
  const { error } = await adminClient()
    .from("exchange_members")
    .insert({
      exchange_id: exchangeId,
      user_id: person.id,
      taking_part: true,
      state,
      left_at: state === "active" ? null : new Date().toISOString(),
    });
  if (error) throw new Error(`addMember failed: ${error.message}`);
}

export async function memberStates(exchangeId: string, userId: string): Promise<string[]> {
  const { data } = await adminClient()
    .from("exchange_members")
    .select("state")
    .eq("exchange_id", exchangeId)
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  return (data ?? []).map((r: { state: string }) => r.state);
}

export async function requestStatuses(exchangeId: string, userId: string): Promise<string[]> {
  const { data } = await adminClient()
    .from("join_requests")
    .select("status")
    .eq("exchange_id", exchangeId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r: { status: string }) => r.status);
}

// Joining closed by the join-by moment passing. WHY join_by_at and gift_day move together: the table
// keeps the gift day after the join-by day, and a request is still allowed until the gift day.
export async function closeJoining(exchangeId: string) {
  const joinBy = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { error } = await adminClient().from("exchanges").update({ join_by_at: joinBy, gift_day: ymdIn(5) }).eq("id", exchangeId);
  if (error) throw new Error(`closeJoining failed: ${error.message}`);
}

// A request that is already waiting, as if the person had asked. WHY a direct insert: it saves a sign-in
// where the ask itself is not what the test covers; no activity event is written by this route.
export async function addRequest(exchangeId: string, person: Person) {
  const { error } = await adminClient().from("join_requests").insert({ exchange_id: exchangeId, user_id: person.id });
  if (error) throw new Error(`addRequest failed: ${error.message}`);
}

// A member whose list is attached, so Participants reads "Wishlist added" (an empty real wishlist counts). WHY
// direct inserts: the attach flow is covered by its own specs; deleteTestUser removes the list with its owner.
export async function attachWishlist(exchangeId: string, person: Person) {
  const db = adminClient();
  const list = await db.from("wishlists").insert({ owner_id: person.id, name: "Wishes" }).select("id").single();
  if (list.error || !list.data) throw new Error(`attachWishlist failed: ${list.error?.message}`);
  const { error } = await db
    .from("exchange_members")
    .update({ attached_wishlist_id: list.data.id })
    .eq("exchange_id", exchangeId)
    .eq("user_id", person.id);
  if (error) throw new Error(`attachWishlist attach failed: ${error.message}`);
}
