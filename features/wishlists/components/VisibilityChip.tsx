import { Globe, Lock } from "@phosphor-icons/react/dist/ssr";
import { Chip } from "@/components/ui/Chip";
import { WISHLIST_COPY } from "../copy";
import type { WishlistVisibility } from "../types";

// GC-018: who can see a list, with the lock or globe icon beside the words (the icon never carries
// the meaning alone). "row" is the short label on My wishlists; "page" is the line on the list itself.
export function VisibilityChip({ visibility, size }: { visibility: WishlistVisibility; size: "row" | "page" }) {
  const isLink = visibility === "link";
  const label =
    size === "row"
      ? isLink
        ? WISHLIST_COPY.rowLink
        : WISHLIST_COPY.rowPrivate
      : isLink
        ? WISHLIST_COPY.chipLink
        : WISHLIST_COPY.chipPrivate;
  return (
    <Chip variant="meta" icon={isLink ? Globe : Lock}>
      {label}
    </Chip>
  );
}
