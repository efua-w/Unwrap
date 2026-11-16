"use server";

import { revalidatePath } from "next/cache";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/wishlist";
import { getActivityPage } from "./queries";
import type { ActivityPage } from "./types";

// Activity actions (GC-006 S09). WHY no user id: the database reads the caller from the session, so both
// calls affect and read the signed-in person's own events only (AC-23).

export type MarkReadResult = { ok: true } | { ok: false };
export type OlderResult = ({ ok: true } & ActivityPage) | { ok: false };

// Q12: this is the only thing that marks events read. WHY the layout is revalidated: every signed-in page
// shows the badge, so all of them must read the new count.
export async function markAllActivityRead(): Promise<MarkReadResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const { error } = await supabase.rpc("mark_all_activity_read");
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}

// The page after the last row shown. The cursor comes from the client, so it is checked: a time that is
// not a time or an id that is not an id never reaches the database.
export async function loadOlderActivity(beforeAt: unknown, beforeId: unknown): Promise<OlderResult> {
  if (typeof beforeAt !== "string" || Number.isNaN(Date.parse(beforeAt))) return { ok: false };
  if (typeof beforeId !== "string" || !isUuid(beforeId)) return { ok: false };
  try {
    const page = await getActivityPage({ beforeAt, beforeId }, new Date(), await readViewerTimeZone());
    return { ok: true, ...page };
  } catch {
    return { ok: false };
  }
}
