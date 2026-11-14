import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ListContent } from "@/features/exchange-list/components/ListContent";
import { ListSkeleton } from "@/features/exchange-list/components/ListSkeleton";
import { InviteFrame } from "@/features/joining/components/InviteFrame";
import { requireProfile } from "@/lib/auth/session";

// GC-010 / S11 Attach list (participant). Boards: Joining-Attach-* (m, d). Reached from Join with
// ?from=join (owner Q11): then it is the standalone page with Skip for now, and the person goes on to
// You're in. From the exchange page it is an in-app page with Back and no Skip.
export const metadata: Metadata = { title: "Your list for this exchange" };

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const fromJoin = from === "join";
  const profile = await requireProfile(`/exchanges/${encodeURIComponent(id)}/list${fromJoin ? "?from=join" : ""}`);
  const content = (
    <Suspense fallback={<ListSkeleton />}>
      <ListContent id={id} viewerId={profile.id} mode="participant" fromJoin={fromJoin} />
    </Suspense>
  );
  if (fromJoin) return <InviteFrame>{content}</InviteFrame>;
  return (
    <AppShell profile={{ name: profile.displayName }} back={{ label: "Back", href: `/exchanges/${encodeURIComponent(id)}` }}>
      {content}
    </AppShell>
  );
}
