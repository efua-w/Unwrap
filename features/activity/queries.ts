import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { toActivityItem } from "./group";
import { parseActivityRows, parseUnreadCount } from "./parse";
import type { ActivityCursor, ActivityPage } from "./types";

export const ACTIVITY_PAGE_SIZE = 30;

// The unread count for the Activity tab, read once per request however many components ask (AC-25).
// WHY 0 on any failure: a badge that cannot be read shows no badge, and never an error on every page
// (plan §3). A wrong "0" is safe; the Activity page itself still says what is unread.
export const getUnreadActivityCount = cache(async (): Promise<number> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_unread_activity_count");
    if (error) return 0;
    return parseUnreadCount(data) ?? 0;
  } catch {
    return 0;
  }
});

// One page of the signed-in person's activity, newest first (GC-006 S09). WHY keyset: the cursor is the
// last row shown, so events written while the person reads never shift a page or repeat a row. One extra
// row is asked for, to know whether an older page exists without a second call. Throws when the read or
// the shape fails; the screen shows its error state.
export async function getActivityPage(cursor: ActivityCursor | null, now: Date, timeZone: string): Promise<ActivityPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_activity", {
    p_limit: ACTIVITY_PAGE_SIZE + 1,
    ...(cursor ? { p_before_at: cursor.beforeAt, p_before_id: cursor.beforeId } : {}),
  });
  if (error) throw new Error("Could not read your activity.");
  const rows = parseActivityRows(data);
  if (rows === null) throw new Error("Unexpected activity answer.");

  const shown = rows.slice(0, ACTIVITY_PAGE_SIZE);
  const last = shown[shown.length - 1];
  return {
    items: shown.map((row) => toActivityItem(row, now, timeZone)),
    cursor: rows.length > ACTIVITY_PAGE_SIZE && last ? { beforeAt: last.createdAt, beforeId: last.id } : null,
  };
}
