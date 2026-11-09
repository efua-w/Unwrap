import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { PROFILE_HREF } from "./nav-items";
import type { ShellProfile } from "./Sidebar";

export type BackLink = { label: string; href: string };

type Props = { variant?: "top"; profile: ShellProfile } | { variant: "back"; back: BackLink };

/** The labelled Back link (UwButton "back"). WHY a plain link with no background or hover fill:
 * it only navigates, so it must not look like a button (owner, 2026-11-09). */
export function BackButton({ back }: { back: BackLink }) {
  // WHY: owner decision 2026-11-03: the in-app Back always goes to the parent page, so it never
  // leaves the app. Browser Back is unchanged. A plain link needs no client code.
  return (
    <Link
      href={back.href}
      className="inline-flex min-h-touch-target items-center gap-4 rounded-lg pr-4 text-body-sm-semibold text-text-default hover:underline focus-ring"
    >
      <Icon icon={CaretLeft} />
      {back.label}
    </Link>
  );
}

// Below 768 only. From 768 the Sidebar carries the wordmark and profile, and Back sits inside the page.
export function Header(props: Props) {
  if (props.variant === "back") {
    return (
      <div className="pt-8 md:hidden">
        <header className="flex min-h-48 items-center gap-4 px-16">
          <BackButton back={props.back} />
        </header>
      </div>
    );
  }
  return (
    <div className="pt-16 md:hidden">
      <header className="flex h-48 items-center justify-between px-20">
        <p className="font-heading text-heading-4">Unwrap</p>
        <ProfileLink profile={props.profile} />
      </header>
    </div>
  );
}

export function ProfileLink({ profile }: { profile: ShellProfile }) {
  return (
    // WHY: a text name instead of aria-label, because the avatar shows initials and an aria-label
    // that does not contain the visible text fails WCAG 2.5.3 (found by axe).
    <Link href={PROFILE_HREF} className="rounded-full focus-ring">
      <Avatar name={profile.name} size="nav" decorative />
      <span className="sr-only">Profile and settings</span>
    </Link>
  );
}
