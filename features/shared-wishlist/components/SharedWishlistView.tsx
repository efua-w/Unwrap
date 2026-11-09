import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ListRow } from "@/components/ui/ListRow";
import { itemCountLabel, itemSub, PRIORITY_LABEL } from "@/features/wishlists/copy";
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
          <div className="flex justify-between gap-16 text-body-sm-regular text-text-muted">
            <span>{itemCountLabel(items.length)}</span>
            <span>{SHARED_COPY.order}</span>
          </div>
          <ul className="flex flex-col">
            {items.map((item, index) => {
              const meta = (
                <Chip variant={item.priority === "most_wanted" ? "label" : "meta"}>{PRIORITY_LABEL[item.priority]}</Chip>
              );
              const common = { title: item.name, sub: itemSub(item), meta, divider: index > 0 };
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
