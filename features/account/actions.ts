"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isVisibility } from "@/lib/validation/wishlist";
import { isNotificationKey, type NotificationKey } from "./notifications";

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

// WHY a table of the four writes: only these columns can be switched, whatever key the browser sends.
type NotificationUpdate =
  | { notify_names_drawn: boolean }
  | { notify_someone_joins: boolean }
  | { notify_join_by_reminder: boolean }
  | { notify_event_reminder: boolean };
const NOTIFICATION_COLUMN: Record<NotificationKey, (value: boolean) => NotificationUpdate> = {
  namesDrawn: (v) => ({ notify_names_drawn: v }),
  someoneJoins: (v) => ({ notify_someone_joins: v }),
  joinByReminder: (v) => ({ notify_join_by_reminder: v }),
  eventReminder: (v) => ({ notify_event_reminder: v }),
};

export type SetNotificationResult = { ok: true } | { ok: false; reason: "signed-out" | "failed" };

// GC-026: turn one email on or off. WHY the key is mapped to a column here: only the four columns the person
// may switch can be written, and the user id comes from the session (Backend rules); Row Level Security also
// limits the update to their own row.
export async function setNotificationSetting(key: unknown, value: unknown): Promise<SetNotificationResult> {
  if (!isNotificationKey(key) || typeof value !== "boolean") return { ok: false, reason: "failed" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed-out" };

  const { data, error } = await supabase
    .from("user_settings")
    .update(NOTIFICATION_COLUMN[key](value))
    .eq("user_id", auth.user.id)
    .select("user_id");
  if (error || !data || data.length !== 1) return { ok: false, reason: "failed" };
  revalidatePath("/profile/notifications");
  return { ok: true };
}
