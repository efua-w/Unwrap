import { cookies } from "next/headers";
import { getViewerTimeZone, TIME_ZONE_COOKIE } from "./timezone";

// Server-side reader for the viewer's zone. Call it from pages, not the root layout: reading
// cookies() there would make every route dynamic.
export async function readViewerTimeZone(): Promise<string> {
  const store = await cookies();
  return getViewerTimeZone(store.get(TIME_ZONE_COOKIE)?.value);
}
