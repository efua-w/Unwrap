import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_NEXT_PATH } from "./next-path";

export type MyProfile = { id: string; displayName: string; onboarded: boolean };

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
    .select("display_name, onboarded_at")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw new Error("Could not read the profile.");
  // WHY: every auth user gets a profile from the sign-up trigger. A missing one is a setup fault,
  // not a signed-out visitor, so it must not be hidden behind a redirect loop.
  if (!row) throw new Error("Signed-in user has no profile.");
  return { id: data.user.id, displayName: row.display_name, onboarded: row.onboarded_at !== null };
});

// WHY page-level, not in a layout: Next does not re-render a layout when moving between pages
// under it, so a layout check would not run on every navigation. Each protected page calls this.
// `returnTo` is where to land after logging in (sanitised again by the Log in page).
// WHY the onboarding check here (GC-005, audit finding 3, 2026-11-13): the server decides whether a
// person still needs Profile setup, from profiles.onboarded_at, on every signed-in page. An abandoned
// sign-up that later logs in lands there whatever the browser says. Profile setup itself opts out.
export async function requireProfile(returnTo: string, options: { allowNotOnboarded?: boolean } = {}): Promise<MyProfile> {
  const profile = await getMyProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!profile.onboarded && !options.allowNotOnboarded) {
    redirect(returnTo === DEFAULT_NEXT_PATH ? "/welcome" : `/welcome?next=${encodeURIComponent(returnTo)}`);
  }
  return profile;
}

// For Sign up, Log in and Verify: a signed-in person has no business there. They go to the page
// they were heading for (`next`, already sanitised by the caller), or Home.
export async function redirectIfSignedIn(next?: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(next ?? "/home");
}
