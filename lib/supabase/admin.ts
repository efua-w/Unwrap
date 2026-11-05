import "server-only";
import { getSupabaseEnv } from "./env";

// Server-only use of SUPABASE_SECRET_KEY (owner decision 2026-11-04, open item 36). It bypasses
// Row Level Security, so this module does one narrow thing and returns only what the caller needs.
// WHY three guards: `server-only` fails the build if a client component imports this, the lint rule
// in eslint.config.mjs refuses the import outside Server Action files, and this runtime check
// stops it in a browser even if both are bypassed. The key is never logged or returned.
if (typeof window !== "undefined") {
  throw new Error("lib/supabase/admin is server-only.");
}

export type AuthUserMatch = { email: string | null; emailConfirmedAt: string | null };
export type EmailLookup = { users: AuthUserMatch[]; total: number | null };

const PER_PAGE = 50;
const TIMEOUT_MS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Asks Supabase Auth for the users whose email contains `email`. WHY the raw admin endpoint: the
// supabase-js admin client can only page through every user; the Auth server's `filter` parameter
// does the match in the database, so no user list ever reaches this server. The match is a
// substring (SQL LIKE), so the caller must compare emails exactly. Returns null when the key is
// missing or the request fails, so the caller can fall back to the browser-only check.
export async function findAuthUsersByEmail(email: string): Promise<EmailLookup | null> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  const { url } = getSupabaseEnv();
  try {
    const response = await fetch(
      `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=${PER_PAGE}`,
      {
        headers: { apikey: secret, Authorization: `Bearer ${secret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.users)) return null;
    const users = body.users.filter(isRecord).map(
      (u): AuthUserMatch => ({
        email: typeof u.email === "string" ? u.email : null,
        emailConfirmedAt: typeof u.email_confirmed_at === "string" ? u.email_confirmed_at : null,
      }),
    );
    const totalHeader = Number(response.headers.get("x-total-count"));
    return { users, total: Number.isFinite(totalHeader) && response.headers.has("x-total-count") ? totalHeader : null };
  } catch {
    return null;
  }
}
