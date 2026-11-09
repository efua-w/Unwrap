import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parsePublicWishlist } from "./parse";
import type { PublicWishlist } from "./types";

// WHY the same pattern as the database function: a malformed token never reaches it, and the answer
// is the same "unavailable" as for an unknown one.
const TOKEN = /^[0-9a-f]{32}$/;

// GC-023: the public view of a shared list, or null for every unavailable case. It calls the one
// database function visitors may execute, through the normal server client (so a signed-in visitor
// is simply an authenticated caller). A failed call throws instead of returning null: "we could not
// check" must never look like "this list is private".
export async function getSharedWishlist(token: string): Promise<PublicWishlist | null> {
  if (!TOKEN.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_wishlist", { p_token: token });
  if (error) throw new Error("Could not read the shared wishlist.");
  return parsePublicWishlist(data);
}
