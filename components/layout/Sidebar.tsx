import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { NavLinks } from "./NavLinks";
import { PROFILE_HREF } from "./nav-items";

export type ShellProfile = { name: string };

export function Sidebar({ profile, unreadActivity }: { profile: ShellProfile; unreadActivity: number }) {
  return (
    <div className="sticky top-0 h-dvh w-1/5 min-w-sidebar-min max-w-sidebar-max shrink-0 flex-col gap-24 bg-surface-subtle p-16 max-md:hidden md:flex">
      <p className="px-16 pt-8 font-heading text-heading-4">Unwrap</p>
      <nav aria-label="Main" className="flex-1">
        <NavLinks layout="side" unreadActivity={unreadActivity} />
      </nav>
      <Link
        href={PROFILE_HREF}
        className="flex min-h-touch-target items-center gap-12 rounded-full px-8 text-body-base-medium hover:bg-surface-muted focus-ring"
      >
        <Avatar name={profile.name} size="face" decorative />
        <span className="min-w-0 truncate">{profile.name}</span>
      </Link>
    </div>
  );
}
