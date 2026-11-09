"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isVisibility } from "@/lib/validation/wishlist";

export type SetDefaultVisibilityResult = { ok: true } | { ok: false; reason: "signed-out" | "failed" };

// GC-027: save the default for new wishlists. WHY the user id is read from the session here and
// never taken from the browser: a client-supplied id would be trusted for nothing (Backend rules);
// Row Level Security also limits the update to the caller's own row.
export async function setDefaultVisibility(value: unknown): Promise<SetDefaultVisibilityResult> {
  if (!isVisibility(value)) return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };

  const { data, error } = await supabase
    .from("user_settings")
    .update({ default_wishlist_visibility: value })
    .eq("user_id", auth.user.id)
    .select("user_id");
  if (error || !data || data.length !== 1) return { ok: false, reason: "failed" };
  revalidatePath("/profile/privacy");
  revalidatePath("/wishlists");
  return { ok: true };
}
