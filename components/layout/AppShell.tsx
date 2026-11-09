import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { BottomTabs } from "./BottomTabs";
import { BackButton, Header, type BackLink } from "./Header";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar, type ShellProfile } from "./Sidebar";

type Props = {
  profile: ShellProfile;
  children: ReactNode;
  /** Unread activity count for the Activity tab. */
  unreadActivity?: number;
  /** Form pages and sheets hide the bottom tabs (plan §8). */
  hideTabs?: boolean;
  /** A child page: a Back bar below 768, a Back button first in the page from 768. */
  back?: BackLink;
  /** Top-level pages: "wordmark" shows the Unwrap header below 768 (Home); "heading" means the page
   *  renders its own PageHeading row with the avatar (Exchanges, Wishlists, Activity). */
  top?: "wordmark" | "heading";
};

export function AppShell({ profile, children, unreadActivity = 0, hideTabs = false, back, top = "wordmark" }: Props) {
  // Mobile top padding per board: 8 under a Back bar, 32 under the wordmark header, 16 above a heading row.
  const mobileTop = back ? "pt-8" : top === "wordmark" ? "pt-32" : "pt-16";
  return (
    <div className="flex min-h-dvh">
      <Sidebar profile={profile} unreadActivity={unreadActivity} />
      <div className={cx("min-w-0 flex-1", !hideTabs && "max-md:pb-control-lg")}>
        {/* WHY: the banner lives in the content column, so from 768 it sits beside the sticky Sidebar instead of over it (T6-1, owner decision 2026-11-03). */}
        <OfflineBanner />
        {back ? <Header variant="back" back={back} /> : top === "wordmark" ? <Header profile={profile} /> : null}
        {/* WHY: from 768 the content starts 80 from the Sidebar (owner 2026-11-09). */}
        <main
          id="main"
          tabIndex={-1}
          className={cx("w-full px-20 pb-24 focus:outline-none md:pb-64 md:pl-80 md:pr-40 md:pt-40", mobileTop)}
        >
          <div className="mx-auto w-full max-w-content-max">
            {back ? (
              <div className="pb-32 max-md:hidden">
                <BackButton back={back} />
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
      {hideTabs ? null : <BottomTabs unreadActivity={unreadActivity} />}
    </div>
  );
}
