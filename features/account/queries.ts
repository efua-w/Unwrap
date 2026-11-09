import "server-only";
import type { WishlistVisibility } from "@/lib/validation/wishlist";
import { createClient } from "@/lib/supabase/server";

// GC-027: what a new wishlist starts as. Read under the person's own Row Level Security, so it can
// only ever be their own row.
export async function getDefaultVisibility(): Promise<WishlistVisibility> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("user_settings")
    .select("default_wishlist_visibility")
    .eq("user_id", auth.user.id)
    .single();
  if (error) throw new Error("Could not read the default visibility.");
  return data.default_wishlist_visibility;
}

// WHY a fallback: New wishlist must still open when the setting cannot be read, and Private is the
// safe start (GC-027, owner answer 2026-11-08).
export async function getDefaultVisibilityOrPrivate(): Promise<WishlistVisibility> {
  try {
    return await getDefaultVisibility();
  } catch {
    return "private";
  }
}
