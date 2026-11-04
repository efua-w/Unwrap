import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { BottomTabs } from "./BottomTabs";
import { Header } from "./Header";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar, type ShellProfile } from "./Sidebar";

type Props = {
  profile: ShellProfile;
  children: ReactNode;
  /** Unread activity count for the Activity tab. */
  unreadActivity?: number;
  /** Form pages and sheets hide the bottom tabs (plan §8). */
  hideTabs?: boolean;
  /** Replaces the default top-level Header, for example with the back variant. */
  header?: ReactNode;
};

export function AppShell({ profile, children, unreadActivity = 0, hideTabs = false, header }: Props) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar profile={profile} unreadActivity={unreadActivity} />
      <div className={cx("min-w-0 flex-1", !hideTabs && "max-md:pb-control-lg")}>
        {/* WHY: the banner lives in the content column, so from 768 it sits beside the sticky Sidebar instead of over it (T6-1, owner decision 2026-11-03). */}
        <OfflineBanner />
        {header ?? <Header profile={profile} />}
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-content-max px-16 pb-24 pt-16 focus:outline-none md:px-32">
          {children}
        </main>
      </div>
      {hideTabs ? null : <BottomTabs unreadActivity={unreadActivity} />}
    </div>
  );
}
