import { NavLinks } from "./NavLinks";

// WHY: `hidden max-md:block` (not `md:hidden`) so the component's own display never fights the
// breakpoint. Shown below 768 only; from 768 the Sidebar replaces it.
export function BottomTabs({ unreadActivity }: { unreadActivity: number }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 hidden h-control-lg border-t-1 border-border-default bg-surface-default max-md:block"
    >
      <NavLinks layout="bottom" unreadActivity={unreadActivity} />
    </nav>
  );
}
