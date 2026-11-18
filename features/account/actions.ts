"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isVisibility } from "@/lib/validation/wishlist";
import { isNotificationKey } from "./notifications";

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

export type SetNotificationResult = { ok: true } | { ok: false; reason: "signed-out" | "failed" };

// GC-026: turn one email on or off. WHY the key is mapped to a column here: only the two columns the person
// may switch can be written, and the user id comes from the session (Backend rules); Row Level Security also
// limits the update to their own row.
export async function setNotificationSetting(key: unknown, value: unknown): Promise<SetNotificationResult> {
  if (!isNotificationKey(key) || typeof value !== "boolean") return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };

  const { data, error } = await supabase
    .from("user_settings")
    .update(key === "namesDrawn" ? { notify_names_drawn: value } : { notify_someone_joins: value })
    .eq("user_id", auth.user.id)
    .select("user_id");
  if (error || !data || data.length !== 1) return { ok: false, reason: "failed" };
  revalidatePath("/profile/notifications");
  return { ok: true };
}
