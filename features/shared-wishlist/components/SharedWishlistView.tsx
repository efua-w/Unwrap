import { formatNaira } from "@/lib/money/naira";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ListRow } from "@/components/ui/ListRow";
import { itemCountLabel, PRIORITY_LABEL } from "@/features/wishlists/copy";
import { SHARED_COPY, sharedIntro } from "../copy";
import type { PublicWishlist } from "../types";
import { SharedFrame } from "./SharedFrame";

// GC-023 / S25 Shared wishlist (viewer), default and empty. Boards: Wishlist-Shared-default and
// -empty (m and d). A row with a shop link opens it in a new tab; a row without one is not tappable.
export function SharedWishlistView({ wishlist }: { wishlist: PublicWishlist }) {
  const { name, ownerDisplayName, items } = wishlist;
  const intro = sharedIntro(items.length, ownerDisplayName);
  return (
    <SharedFrame>
      <div className="flex items-center gap-12">
        <Avatar name={ownerDisplayName} size="nav" decorative />
        <span className="min-w-0 break-words text-body-base-semibold">{ownerDisplayName}</span>
      </div>
      <div className="flex flex-col gap-8">
        <h1 className="break-words text-heading-1">{name}</h1>
        {intro ? <p className="text-body-base-regular text-text-secondary">{intro}</p> : null}
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col gap-8">
          <h2 className="text-heading-4">{SHARED_COPY.emptyTitle(ownerDisplayName)}</h2>
          <p className="text-body-base-regular text-text-secondary">{SHARED_COPY.emptyBody(ownerDisplayName)}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <p className="text-body-sm-regular text-text-muted">{itemCountLabel(items.length)}</p>
          <ul className="flex flex-col">
            {items.map((item, index) => {
              // WHY (S25 update 2026-11-09): price and note are separate lines; priority is a badge, with
              // "Most wanted" on the brand wash (owner, 2026-11-09).
              const common = {
                title: item.name,
                sub: item.priceKobo === null ? undefined : formatNaira(item.priceKobo),
                note: item.note ?? undefined,
                meta: (
                  <Chip variant={item.priority === "most_wanted" ? "wash" : "date"}>{PRIORITY_LABEL[item.priority]}</Chip>
                ),
                divider: index > 0,
              };
              return item.link ? (
                <ListRow key={index} {...common} href={item.link} external />
              ) : (
                <ListRow key={index} {...common} />
              );
            })}
          </ul>
        </div>
      )}
      <Button variant="secondary" href="/signup" fullWidth className="md:w-auto md:self-start">
        {SHARED_COPY.makeYourOwn}
      </Button>
    </SharedFrame>
  );
}
