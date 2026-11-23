import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { RecipientContent } from "@/features/gifting/components/RecipientContent";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { GIFT_COPY } from "@/features/gifting/copy";
import { requireProfile } from "@/lib/auth/session";

// GC-015 Recipient's wishlist (S16). Boards: Exchange-Wishlist-default, -loading, -empty, -nolist, -error, -offline, -marked,
// -removed (m, d); the item sheet is ?item=<ref> (S17). In-app page with Back to the exchange. WHY a generic title: the tab
// title and history must not name the person (and the server-rendered page never does).
export const metadata: Metadata = { title: "Their wishlist" };

export default async function RecipientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/exchanges/${encodeURIComponent(id)}/recipient`);
  return (
    <AppShell profile={{ name: profile.displayName }} back={{ label: EXCHANGE_COPY.detail.back, href: `/exchanges/${encodeURIComponent(id)}` }}>
      <Suspense
        fallback={
          <div className="flex flex-col gap-32 md:max-w-reading-max">
            <h1 className="text-heading-2 md:text-heading-1">{GIFT_COPY.loadingTitle}</h1>
            <SkeletonRegion>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} shape="row" />
              ))}
            </SkeletonRegion>
          </div>
        }
      >
        <RecipientContent id={id} />
      </Suspense>
    </AppShell>
  );
}
