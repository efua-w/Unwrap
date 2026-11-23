import type { Metadata } from "next";
import { Suspense } from "react";
import { RevealContent } from "@/features/draw/components/RevealContent";
import { ListSkeleton } from "@/features/exchange-list/components/ListSkeleton";
import { InviteFrame } from "@/features/joining/components/InviteFrame";
import { requireProfile } from "@/lib/auth/session";

// GC-014 Reveal (S15). Boards: Exchange-Reveal-before, -opening, -revealed, -empty, -error, -offline (m, d). Standalone page
// (wordmark and ×). WHY a generic title: the tab title and history must not name the person (and the page never does).
export const metadata: Metadata = { title: "Reveal who you got" };

export default async function RevealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile(`/exchanges/${encodeURIComponent(id)}/reveal`);
  return (
    <Suspense
      fallback={
        <InviteFrame>
          <ListSkeleton />
        </InviteFrame>
      }
    >
      <RevealContent id={id} />
    </Suspense>
  );
}
