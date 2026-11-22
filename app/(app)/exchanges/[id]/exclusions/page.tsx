import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ExclusionsContent, ExclusionsLoading } from "@/features/exclusions/components/ExclusionsContent";
import { EXCLUSIONS_COPY } from "@/features/exclusions/copy";
import { requireProfile } from "@/lib/auth/session";

// GCO-009 / S33 Exclusions. Boards: Org-Excl-empty, -default, -pairfirst, -pairsecond, -impossible, -saved, -two,
// -locked (m, d). Organiser only: everyone else gets the S47 "isn't available" page, and a signed-out visitor goes to
// Log in. Entered from Organiser tools on the exchange page; Back returns to the exchange and throws the draft away.
export const metadata: Metadata = { title: EXCLUSIONS_COPY.title };

export default async function ExclusionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/exchanges/${encodeURIComponent(id)}`;
  const profile = await requireProfile(`${path}/exclusions`);
  return (
    <AppShell profile={{ name: profile.displayName }} back={{ label: EXCLUSIONS_COPY.back, href: path }}>
      <Suspense fallback={<ExclusionsLoading />}>
        <ExclusionsContent id={id} viewerId={profile.id} />
      </Suspense>
    </AppShell>
  );
}
