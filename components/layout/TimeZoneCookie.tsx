"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TIME_ZONE_COOKIE } from "@/lib/dates/timezone";

const REFRESHED_KEY = "tz-refreshed";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Saves the browser's time zone in the `tz` cookie so Server Components can format dates in the
// viewer's own zone. Sets it only when it differs, and refreshes at most once per session so the
// first server render is corrected without a loop.
export function TimeZoneCookie() {
  const router = useRouter();

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.slice(TIME_ZONE_COOKIE.length + 1);
    if (current && decodeURIComponent(current) === zone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    // WHY: refresh only if the cookie stuck, else every visit would refresh in vain (R1-2).
    if (!document.cookie.split("; ").some((c) => c.startsWith(`${TIME_ZONE_COOKIE}=`))) return;
    // WHY: sessionStorage throws when storage is blocked; that must never crash the layout (R1-2).
    try {
      if (sessionStorage.getItem(REFRESHED_KEY)) return;
      sessionStorage.setItem(REFRESHED_KEY, "1");
    } catch {
      return;
    }
    router.refresh();
  }, [router]);

  return null;
}
