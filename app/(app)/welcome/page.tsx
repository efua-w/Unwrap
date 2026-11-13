import { ProfileSetupForm } from "@/features/account/ProfileSetupForm";
import { safeNextOrUndefined, sanitizeNext } from "@/lib/auth/next-path";
import { requireProfile } from "@/lib/auth/session";

type SearchParams = Promise<{ next?: string | string[] }>;

// S06 Profile setup (GC-005). Signed-in only. The name starts as the sign-up first name.
export default async function WelcomePage({ searchParams }: { searchParams: SearchParams }) {
  const { next: rawNext } = await searchParams;
  const next = safeNextOrUndefined(rawNext);
  // WHY: a signed-out visit keeps its deep link through Log in, instead of dropping it.
  const profile = await requireProfile(next ? `/welcome?next=${encodeURIComponent(next)}` : "/welcome", {
    allowNotOnboarded: true,
  });
  return <ProfileSetupForm initialName={profile.displayName} next={sanitizeNext(next)} />;
}
