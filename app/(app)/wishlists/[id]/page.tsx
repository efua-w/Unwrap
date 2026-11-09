import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { LoadError } from "@/features/wishlists/components/LoadError";
import { WishlistDetail } from "@/features/wishlists/components/WishlistDetail";
import { getMyWishlist } from "@/features/wishlists/queries";
import { requireProfile } from "@/lib/auth/session";

// GC-020 / S21 Wishlist detail (owner). Boards: Wishlist-Detail-* (m and d). Back goes to My
// wishlists (owner decision 2026-11-03: in-app Back always goes to the parent page).
export default async function WishlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/wishlists/${encodeURIComponent(id)}`);
  return (
    <AppShell profile={{ name: profile.displayName }} back={{ label: "Back to Wishlists", href: "/wishlists" }}>
      <Suspense fallback={<DetailLoading />}>
        <DetailContent id={id} />
      </Suspense>
    </AppShell>
  );
}

function DetailLoading() {
  return (
    <SkeletonRegion>
      <Skeleton shape="line" text="lg" className="w-2/3" />
      <Skeleton shape="line" text="sm" className="w-1/2" />
      <Skeleton shape="row" />
      <Skeleton shape="row" />
      <Skeleton shape="row" />
    </SkeletonRegion>
  );
}

async function DetailContent({ id }: { id: string }) {
  let detail;
  try {
    detail = await getMyWishlist(id);
  } catch {
    return <LoadError title="We couldn't load this list." />;
  }

  // GC-018 edge case: someone else's list, a deleted one and a missing one all get this same state,
  // which never names the owner or the list.
  if (!detail) {
    return (
      <EmptyState
        headingLevel={1}
        title="This wishlist is private"
        body="Only its owner, and their giver in an exchange, can see it."
        action={<Button href="/wishlists">Go to your wishlists</Button>}
      />
    );
  }

  return <WishlistDetail list={detail.list} items={detail.items} />;
}
