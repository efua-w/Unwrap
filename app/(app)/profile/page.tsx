import { AppShell } from "@/components/layout/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { ListRow } from "@/components/ui/ListRow";
import { LogOutButton } from "@/features/account/LogOutButton";
import { requireProfile } from "@/lib/auth/session";

// S42 Profile (GC-024), minimal for slice 1: the name and Log out only (owner decision
// 2026-11-04), plus a Privacy link row from slice 3. Photo, masked email, Account and Notifications arrive with slice 16.
export default async function ProfilePage() {
  const profile = await requireProfile("/profile");
  return (
    <AppShell
      profile={{ name: profile.displayName }}
      hideTabs
      // WHY: board says "Back to Exchanges"; that page doesn't exist yet (progress open item 53).
      back={{ label: "Go back", href: "/home" }}
    >
      <div className="flex flex-col items-start gap-24 md:max-w-dialog">
        <div className="flex items-center gap-20">
          <Avatar name={profile.displayName} size="profile" decorative />
          <h1 className="min-w-0 break-words text-heading-2">{profile.displayName}</h1>
        </div>
        {/* GC-027: the way into Privacy (S45). Account and Notifications join it in slice 16. */}
        <ul className="w-full">
          <ListRow href="/profile/privacy" title="Privacy" />
        </ul>
        <LogOutButton />
      </div>
    </AppShell>
  );
}
