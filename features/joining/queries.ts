import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseInvitePreview, parseJoinDetails } from "./parse";
import type { InvitePreview, JoinDetails } from "./types";

// WHY the same pattern as the database functions: a malformed token never reaches them, and the answer
// is the same "can't be used" as for an unknown one (GC-012).
const TOKEN = /^[0-9a-f]{32}$/;

// GC-002: the public preview, or null for every unusable link. Anon may call it, so this works signed
// out. A failed call throws instead of returning null: "we could not check" must never look like
// "this invite is wrong".
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  if (!TOKEN.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invite_preview", { p_token: token });
  if (error) throw new Error("Could not read the invite.");
  return parseInvitePreview(data);
}

// GC-009: the join confirmation's facts. Signed in only (the database refuses anon). Null for a
// malformed or unknown token.
export async function getJoinDetails(token: string): Promise<JoinDetails | null> {
  if (!TOKEN.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_join_details", { p_token: token });
  if (error) throw new Error("Could not read the invite.");
  return parseJoinDetails(data);
}

// GC-009 "Joining as {name}, {email}": the viewer's OWN address, read from their own session. WHY
// here and nowhere else: no other person's email is ever read by this feature (product rules).
export async function getMyEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.email ?? null;
}
