import { Bell, Gift, House, ListHeart } from "@phosphor-icons/react/dist/ssr";
import type { PhosphorIcon } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: PhosphorIcon };

// GC-006 C: the four sections, in this order.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/exchanges", label: "Exchanges", icon: Gift },
  { href: "/wishlists", label: "Wishlists", icon: ListHeart },
  { href: "/activity", label: "Activity", icon: Bell },
];

export const PROFILE_HREF = "/profile";

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Screen readers hear the count; sighted users see the Chip.
export function navAccessibleName(label: string, unread: number): string | undefined {
  return unread > 0 ? `${label}, ${unread} unread` : undefined;
}
