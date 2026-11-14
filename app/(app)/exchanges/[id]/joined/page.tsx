import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteFrame } from "@/features/joining/components/InviteFrame";
import { JoinedContent } from "@/features/exchange-list/components/JoinedContent";
import { ListSkeleton } from "@/features/exchange-list/components/ListSkeleton";
import { requireProfile } from "@/lib/auth/session";

// GC-011 / S12 You're in. Boards: Joining-In-* (m, d). Standalone page (wordmark and ×), reached from Join
// after attaching or skipping. × and Go to exchange both lead to the exchange page.
export const metadata: Metadata = { title: "You're in" };

export default async function JoinedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/exchanges/${encodeURIComponent(id)}/joined`);
  return (
    <Suspense
      fallback={
        <InviteFrame>
          <ListSkeleton />
        </InviteFrame>
      }
    >
      <JoinedContent id={id} viewerId={profile.id} />
    </Suspense>
  );
}
