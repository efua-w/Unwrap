import { AppShell } from "@/components/layout/AppShell";
import { DefaultVisibilityForm } from "@/features/account/DefaultVisibilityForm";
import { getDefaultVisibility } from "@/features/account/queries";
import { LoadError } from "@/features/wishlists/components/LoadError";
import { requireProfile } from "@/lib/auth/session";

// S45 Privacy (GC-027), default section only for slice 3 (owner 2026-11-08): "Default for new
// wishlists". Boards: Acc-Privacy-default, -link, -saveerror, -offline (m and d). Data export and
// "Who sees what" arrive with slice 16. Back goes to Profile.
export default async function PrivacyPage() {
  const profile = await requireProfile("/profile/privacy");
  let initial;
  try {
    initial = await getDefaultVisibility();
  } catch {
    initial = null;
  }
  return (
    <AppShell
      profile={{ name: profile.displayName }}
      hideTabs
      back={{ label: "Go back", href: "/profile" }}
    >
      <div className="flex flex-col gap-32 md:max-w-dialog">
        <header className="flex flex-col gap-8">
          <h1 className="text-heading-1">Privacy</h1>
          <p className="text-body-base-regular text-text-secondary">Changes save as you make them.</p>
        </header>
        {initial === null ? (
          <LoadError title="We couldn't load your privacy settings." />
        ) : (
          <DefaultVisibilityForm initial={initial} />
        )}
      </div>
    </AppShell>
  );
}
