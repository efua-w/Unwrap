"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// WHY: only the email-code calls (signInWithOtp, verifyOtp) run in the browser, so Supabase's
// rate limits count each person's own IP rather than the server's (owner decision 2026-11-04).
// Everything else goes through Server Actions. The publishable key is public by design; access
// control is Row Level Security.
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
