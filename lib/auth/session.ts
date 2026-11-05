import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type MyProfile = { id: string; displayName: string };

// WHY: the type has no email. A person's address is not needed to render the app, and keeping it
// out of this type means it cannot be passed to a component by accident.

// The signed-in person and their own profile, or null when signed out. `getUser` asks Supabase to
// validate the token, so a forged cookie is not accepted (the cookie alone is never trusted).
// Cached per request so a page and its components share one lookup.
export const getMyProfile = cache(async (): Promise<MyProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: row, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw new Error("Could not read the profile.");
  // WHY: every auth user gets a profile from the sign-up trigger. A missing one is a setup fault,
  // not a signed-out visitor, so it must not be hidden behind a redirect loop.
  if (!row) throw new Error("Signed-in user has no profile.");
  return { id: data.user.id, displayName: row.display_name };
});

// WHY page-level, not in a layout: Next does not re-render a layout when moving between pages
// under it, so a layout check would not run on every navigation. Each protected page calls this.
// `returnTo` is where to land after logging in (sanitised again by the Log in page).
export async function requireProfile(returnTo: string): Promise<MyProfile> {
  const profile = await getMyProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return profile;
}

// For Sign up, Log in and Verify: a signed-in person has no business there. They go to the page
// they were heading for (`next`, already sanitised by the caller), or Home.
export async function redirectIfSignedIn(next?: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(next ?? "/home");
}
