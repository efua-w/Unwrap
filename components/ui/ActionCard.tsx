import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type PhosphorIcon } from "./Icon";

export type ActionCardPlacement = "banner" | "tray";

type Props = {
  /** The accessible name of the region. Copy comes from the caller's copy file. */
  label: string;
  /**
   * Where this copy sits. A caller renders the card twice: a "banner" at the top of the page and a "tray" at the end,
   * each in its own place in the page order.
   */
  placement: ActionCardPlacement;
  /** The decorative mark in the circle: a gift for an exchange, a list for a wishlist (board UwCard "source"). */
  icon: PhosphorIcon;
  title: string;
  sub: string;
  /** The one action, as a Button. */
  action: ReactNode;
  /** The close control, at the far right. Banner only: the tray has no close (no mobile board shows one). */
  dismiss?: ReactNode;
  className?: string;
};

// Board UwCard kind "action" (S08 Exchanges-active, S14 Exchange-Detail-drawn, -nolist): the thing that needs the person
// now. A tray pinned above the tab bar below 768, a banner from 768. WHY two placements and no order classes: a CSS
// order would move the card on screen and leave it in the other place in the focus and reading order (WCAG 2.4.3, 1.3.2).
// The caller puts the banner where it reads first and the tray where it reads last; each is hidden (display: none, so
// out of the focus order too) at the size it does not belong to.
// WHY the dismiss is a slot and banner-only: the card knows nothing about where a hide is remembered (the caller wraps it and
// passes the control), and the owner asked for the close on the desktop banner only (2026-11-23). It is a sibling of the
// action, never inside it. The banner is as wide as the content area (the caller places it outside the reading column).
export function ActionCard({ label, placement, icon, title, sub, action, dismiss, className }: Props) {
  return (
    <aside
      aria-label={label}
      className={cx(
        "flex flex-col gap-12 rounded-3xl bg-surface-brand-subtle p-16 shadow-overlay",
        placement === "tray" && "max-md:sticky max-md:bottom-control-lg max-md:z-10 md:hidden",
        placement === "banner" && "max-md:hidden",
        "md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-16 md:rounded-2xl md:px-24 md:shadow-none",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-12 md:flex-1 md:gap-16">
        <span
          aria-hidden="true"
          className="flex size-40 shrink-0 items-center justify-center rounded-full bg-surface-brand-muted text-text-brand md:size-48"
        >
          <Icon icon={icon} size="md" weight="fill" />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="break-words text-body-base-semibold text-text-default md:text-body-lg-semibold">{title}</p>
          <p className="break-words text-body-sm-regular text-text-secondary">{sub}</p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:gap-8">
        {action}
        {placement === "banner" ? dismiss : null}
      </div>
    </aside>
  );
}
