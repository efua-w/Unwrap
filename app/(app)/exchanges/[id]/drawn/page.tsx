import type { Metadata } from "next";
import { Suspense } from "react";
import { DrawnContent } from "@/features/draw/components/DrawnContent";
import { ListSkeleton } from "@/features/exchange-list/components/ListSkeleton";
import { InviteFrame } from "@/features/joining/components/InviteFrame";
import { requireProfile } from "@/lib/auth/session";

// GCO-012 Names drawn (S36). Boards: Org-Drawn-part, Org-Drawn-just (m, d). Standalone page (wordmark and ×) reached from the
// Draw names sheet. Organiser only, while names are drawn (owner Q10); everyone else gets S47.
export const metadata: Metadata = { title: "Names are drawn" };

export default async function DrawnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/exchanges/${encodeURIComponent(id)}/drawn`);
  return (
    <Suspense
      fallback={
        <InviteFrame>
          <ListSkeleton />
        </InviteFrame>
      }
    >
      <DrawnContent id={id} viewerId={profile.id} />
    </Suspense>
  );
}
