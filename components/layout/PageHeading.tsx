import type { ReactNode } from "react";
import { ProfileLink } from "./Header";
import type { ShellProfile } from "./Sidebar";

// Top-level page heading row: H1 plus, below 768, the profile avatar (boards Exchanges-active,
// Wishlist-List-default). From 768 the avatar lives in the Sidebar.
export function PageHeading({ profile, children }: { profile: ShellProfile; children: ReactNode }) {
  return (
    <div className="flex min-h-48 items-center justify-between gap-16">
      <h1 className="text-heading-1">{children}</h1>
      <div className="md:hidden">
        <ProfileLink profile={profile} />
      </div>
    </div>
  );
}
