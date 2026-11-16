import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { getUnreadActivityCount } from "@/features/activity/queries";
import { BottomTabs } from "./BottomTabs";
import { BackButton, Header, type BackLink } from "./Header";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar, type ShellProfile } from "./Sidebar";

type Props = {
  profile: ShellProfile;
  children: ReactNode;
  /** Overrides the unread count (the dev gallery). Left out, the shell reads it itself. */
  unreadActivity?: number;
  /** Form pages and sheets hide the bottom tabs (plan §8). */
  hideTabs?: boolean;
  /** A child page: a Back bar below 768, a Back button first in the page from 768. */
  back?: BackLink;
  /** Top-level pages: "wordmark" shows the Unwrap header below 768 (Home); "heading" means the page
   *  renders its own PageHeading row with the avatar (Exchanges, Wishlists, Activity). */
  top?: "wordmark" | "heading";
};

// WHY the shell reads the count (AC-25, GC-006 C): every signed-in page renders it, so the badge is right
// everywhere without each page passing it. The read is cached per request and gives 0 on failure.
export async function AppShell({ profile, children, unreadActivity, hideTabs = false, back, top = "wordmark" }: Props) {
  const unread = unreadActivity ?? (await getUnreadActivityCount());
  // Mobile top padding per board: 8 under a Back bar, 32 under the wordmark header, 16 above a heading row.
  const mobileTop = back ? "pt-8" : top === "wordmark" ? "pt-32" : "pt-16";
  return (
    <div className="flex min-h-dvh">
      <Sidebar profile={profile} unreadActivity={unread} />
      <div className={cx("flex min-w-0 flex-1 flex-col", !hideTabs && "max-md:pb-control-lg")}>
        {/* WHY: the banner lives in the content column, so from 768 it sits beside the sticky Sidebar instead of over it (T6-1, owner decision 2026-11-03). */}
        <OfflineBanner />
        {back ? <Header variant="back" back={back} /> : top === "wordmark" ? <Header profile={profile} /> : null}
        {/* WHY: from 768 the content starts 80 from the Sidebar (owner 2026-11-09). */}
        <main
          id="main"
          tabIndex={-1}
          className={cx("flex w-full flex-1 flex-col px-20 pb-24 focus:outline-none md:pb-64 md:pl-80 md:pr-40 md:pt-40", mobileTop)}
        >
          {/* WHY a flex column that fills the height: a page can grow to the bottom, so a pinned bar (mt-auto) sits there when the content is short. */}
          <div className="mx-auto flex w-full max-w-content-max flex-1 flex-col">
            {back ? (
              <div className="pb-32 max-md:hidden">
                <BackButton back={back} />
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
      {hideTabs ? null : <BottomTabs unreadActivity={unread} />}
    </div>
  );
}
