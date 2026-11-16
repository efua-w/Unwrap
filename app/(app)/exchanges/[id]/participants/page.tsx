import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ParticipantsContent, ParticipantsLoading } from "@/features/participants/components/ParticipantsContent";
import { PARTICIPANTS_COPY } from "@/features/participants/copy";
import { requireProfile } from "@/lib/auth/session";

// GCO-007 / S30 Participants and S31 Remove person. Boards: Org-People-default, -alone, -loading, -error,
// -offline, -approved, Org-Remove-before, -busy, -done (m, d). Organiser only: everyone else gets the S47
// "isn't available" page, and a signed-out visitor goes to Log in. Entered from the exchange page's People
// "See all" and the request block; Back returns to the exchange.
export const metadata: Metadata = { title: PARTICIPANTS_COPY.title };

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/exchanges/${encodeURIComponent(id)}`;
  const profile = await requireProfile(`${path}/participants`);
  return (
    <AppShell profile={{ name: profile.displayName }} back={{ label: PARTICIPANTS_COPY.back, href: path }}>
      <Suspense fallback={<ParticipantsLoading />}>
        <ParticipantsContent id={id} viewerId={profile.id} />
      </Suspense>
    </AppShell>
  );
}
