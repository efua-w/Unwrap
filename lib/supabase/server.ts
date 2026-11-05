import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Supabase client for Server Components and Server Actions. It uses the signed-in person's
// session, so every query runs under their Row Level Security. The service role is never used
// here (plan §6). A new client is created per request, as the cache headers it sets require.
export async function createClient() {
  const store = await cookies();
  const { url, publishableKey } = getSupabaseEnv();
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          // WHY: Server Components cannot write cookies. proxy.ts refreshes the session on every
          // request, so ignoring the write here is safe.
        }
      },
    },
  });
}
