import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ListContent } from "@/features/exchange-list/components/ListContent";
import { ListSkeleton } from "@/features/exchange-list/components/ListSkeleton";
import { requireProfile } from "@/lib/auth/session";

// GCO-004 / S49 Your list for this exchange (organiser taking part). Boards: Org-List-* (m, d), entered
// from the exchange page, Your part. In-app page with Back and the tab bar; no Skip, and Back leaves
// without a list. Same feature as /list; an organiser who is only organising gets "isn't available".
export const metadata: Metadata = { title: "Your list for this exchange" };

export default async function MyListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/exchanges/${encodeURIComponent(id)}/my-list`);
  return (
    <AppShell profile={{ name: profile.displayName }} back={{ label: "Back", href: `/exchanges/${encodeURIComponent(id)}` }}>
      <Suspense fallback={<ListSkeleton />}>
        <ListContent id={id} viewerId={profile.id} mode="organiser" fromJoin={false} />
      </Suspense>
    </AppShell>
  );
}
