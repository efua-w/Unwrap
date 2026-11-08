import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Refreshes the Supabase session cookie on each request (plan §6). It does NOT decide who may see
// a page: pages and Server Actions check the user themselves, and the database enforces access.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // WHY: a response that sets auth cookies must not be cached by a CDN, or one person's
        // session could be served to another.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  // WHY: getClaims validates the token and triggers the refresh; nothing is trusted from the cookie alone.
  await supabase.auth.getClaims();
  return response;
}
