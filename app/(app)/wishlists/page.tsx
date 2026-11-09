import { ListHeart } from "@phosphor-icons/react/dist/ssr";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeading } from "@/components/layout/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { getDefaultVisibilityOrPrivate } from "@/features/account/queries";
import { itemCountLabel } from "@/features/wishlists/copy";
import { LoadError } from "@/features/wishlists/components/LoadError";
import { NewWishlistButton } from "@/features/wishlists/components/NewWishlistButton";
import { VisibilityChip } from "@/features/wishlists/components/VisibilityChip";
import { hasDeletedWishlists, listMyWishlists } from "@/features/wishlists/queries";
import { requireProfile } from "@/lib/auth/session";
import { formatUpdated } from "@/lib/dates/format-updated";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";

// GC-018 / S19 My wishlists. Boards: Wishlist-List-default, -first, -gone, -error, -loading,
// -offline (m and d). Not in slice 2: the "Your givers in X and Y" label (exchanges, slice 5).
export default async function WishlistsPage() {
  const profile = await requireProfile("/wishlists");
  return (
    <AppShell profile={{ name: profile.displayName }} top="heading">
      <div className="flex flex-col gap-24">
        <PageHeading profile={{ name: profile.displayName }}>Wishlists</PageHeading>
        <Suspense fallback={<WishlistsLoading />}>
          <WishlistsContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

function WishlistsLoading() {
  return (
    <SkeletonRegion>
      <Skeleton shape="row" />
      <Skeleton shape="row" />
    </SkeletonRegion>
  );
}

async function WishlistsContent() {
  let lists;
  let gone = false;
  // GC-027: a new list starts from the person's default (Private when it cannot be read).
  const defaultVisibility = await getDefaultVisibilityOrPrivate();
  try {
    lists = await listMyWishlists();
    if (lists.length === 0) gone = await hasDeletedWishlists();
  } catch {
    return <LoadError title="We couldn't load your wishlists." />;
  }

  if (lists.length === 0) {
    return gone ? (
      <EmptyState
        icon={ListHeart}
        title="You don't have any wishlists right now."
        body="Make one for your next exchange or birthday."
        action={<NewWishlistButton defaultVisibility={defaultVisibility} />}
      />
    ) : (
      // Board Wishlist-List-first, copy as written; owner approved 2026-11-08 (R1-2), including
      // "until you share it" (nothing is live before slice 3).
      <EmptyState
        icon={ListHeart}
        title="Make your first wishlist."
        body="Your giver will know exactly what you'd like, so you get something you'll use. Only you can see it until you share it or add it to an exchange."
        action={<NewWishlistButton defaultVisibility={defaultVisibility} />}
      />
    );
  }

  // Dates in the viewer's own zone (product rules).
  const timeZone = await readViewerTimeZone();
  const now = new Date();
  return (
    <>
      <ul className="flex flex-col">
        {lists.map((list, index) => (
          <ListRow
            key={list.id}
            href={`/wishlists/${list.id}`}
            title={list.name}
            sub={`${itemCountLabel(list.itemCount)} · updated ${formatUpdated(new Date(list.updatedAt), now, timeZone)}`}
            meta={<VisibilityChip visibility={list.visibility} size="row" />}
            divider={index > 0}
          />
        ))}
      </ul>
      <div>
        <NewWishlistButton defaultVisibility={defaultVisibility} />
      </div>
    </>
  );
}
