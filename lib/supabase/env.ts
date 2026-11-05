// WHY: the two NEXT_PUBLIC_ names are read as literal `process.env.X` expressions so Next can inline
// them into the browser bundle. A missing value fails loudly here instead of surfacing later as a
// confusing network error from the Supabase client. Values live in .env.local, never in code.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function getSupabaseEnv(): { url: string; publishableKey: string } {
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }
  return { url, publishableKey };
}
