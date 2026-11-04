"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { isActivePath, NAV_ITEMS, navAccessibleName } from "./nav-items";

type Props = {
  layout: "bottom" | "side";
  /** Unread activity count; the Activity item shows it as a Chip. */
  unreadActivity: number;
};

export function NavLinks({ layout, unreadActivity }: Props) {
  const pathname = usePathname();
  const bottom = layout === "bottom";

  return (
    <ul className={cx("flex", bottom ? "h-full" : "flex-col gap-4")}>
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);
        const unread = item.href === "/activity" ? unreadActivity : 0;
        const labelNode = <span>{item.label}</span>;
        return (
          <li key={item.href} className={bottom ? "flex-1" : undefined}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={navAccessibleName(item.label, unread)}
              onClick={() => {
                // Tapping the tab you are already on scrolls back to the top.
                if (active) window.scrollTo({ top: 0 });
              }}
              className={cx(
                "focus-ring",
                bottom
                  ? "flex h-full flex-col-reverse items-center justify-center gap-2 text-body-xs-medium"
                  : "flex min-h-touch-target items-center gap-12 rounded-full px-16 text-body-base-medium",
                active ? "text-text-default" : "text-text-muted",
                !bottom && (active ? "bg-surface-default" : "hover:bg-surface-muted"),
              )}
            >
              {/* WHY: the badge is placed from its own box (translate) and the icon box (percent), not a raw offset. */}
              {/* WHY: in the bottom tabs the label comes first in the DOM and flex-col-reverse puts it below the icon, so the
                  visible text reads "Activity 3" in both layouts and the aria-label contains it (WCAG 2.5.3). The literal
                  space keeps the label and the count apart in that text. */}
              {bottom ? labelNode : null}
              {bottom ? " " : null}
              <span className="relative inline-flex">
                <Icon icon={item.icon} size="lg" weight={active ? "fill" : "regular"} />
                {unread > 0 && bottom ? (
                  <span aria-hidden="true">
                    <Chip variant="count" count={unread} className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2" />
                  </span>
                ) : null}
              </span>
              {bottom ? null : labelNode}
              {bottom ? null : " "}
              {unread > 0 && !bottom ? (
                <span aria-hidden="true" className="ml-auto">
                  <Chip variant="count" count={unread} />
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
