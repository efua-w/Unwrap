import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PROFILE_HREF } from "./nav-items";
import type { ShellProfile } from "./Sidebar";

type Props =
  | { variant?: "top"; profile: ShellProfile }
  | { variant: "back"; title: string; parentHref: string };

export function Header(props: Props) {
  if (props.variant === "back") {
    return (
      <header className="flex h-48 items-center gap-8 px-8">
        {/* WHY: owner decision 2026-11-03: the in-app Back always goes to the parent page, so it never
            leaves the app. Browser Back is unchanged. A plain link needs no client code. */}
        <Button variant="icon" icon={ArrowLeft} label="Back" href={props.parentHref} />
        <p className="min-w-0 flex-1 truncate text-heading-5">{props.title}</p>
      </header>
    );
  }
  // Top level: visible below 768 only. From 768 the Sidebar carries the wordmark and profile.
  return (
    <header className="hidden h-48 items-center justify-between px-16 max-md:flex">
      <p className="font-heading text-heading-4">Unwrap</p>
      {/* WHY: a text name instead of aria-label, because the avatar shows initials and an aria-label
          that does not contain the visible text fails WCAG 2.5.3 (found by axe). */}
      <Link href={PROFILE_HREF} className="rounded-full focus-ring">
        <Avatar name={props.profile.name} size="nav" decorative />
        <span className="sr-only">Profile and settings</span>
      </Link>
    </header>
  );
}
