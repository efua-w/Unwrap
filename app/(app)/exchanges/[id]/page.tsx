import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { ExchangeJustStarted } from "@/features/exchanges/components/ExchangeJustStarted";
import { ExchangeMemberView } from "@/features/exchanges/components/ExchangeMemberView";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { NotAvailable } from "@/features/exchanges/components/NotAvailable";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { getMemberExchange, getOrganiserExchange } from "@/features/exchanges/queries";
import { requireProfile } from "@/lib/auth/session";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";
import { buildInviteUrl } from "@/lib/site-url";

// S14 Exchange detail before the draw (GC-013, GCO-004): the organiser's page (boards Exchange-Detail-started,
// -ostarted, -oattached, -oideas, -copied, -loading, -error, -offline) and the participant's (Exchange-Detail-before,
// -nolist); S47 Acc-NA-exchange. Back goes to Exchanges (owner decision 2026-11-03: in-app Back goes to the parent
// page). The draw and later states arrive with slices 10 to 16.
export default async function ExchangePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/exchanges/${encodeURIComponent(id)}`);
  return (
    <AppShell profile={{ name: profile.displayName }} back={{ label: EXCHANGE_COPY.detail.back, href: "/exchanges" }}>
      <Suspense fallback={<DetailLoading />}>
        <DetailContent id={id} viewerId={profile.id} />
      </Suspense>
    </AppShell>
  );
}

// Board Exchange-Detail-loading: a header block, two rows, another block.
function DetailLoading() {
  return (
    <SkeletonRegion>
      <Skeleton shape="line" text="lg" className="w-2/3" />
      <Skeleton shape="line" text="sm" className="w-1/2" />
      <Skeleton shape="row" />
      <Skeleton shape="row" />
      <Skeleton shape="line" text="sm" className="w-1/2" />
    </SkeletonRegion>
  );
}

async function DetailContent({ id, viewerId }: { id: string; viewerId: string }) {
  const copy = EXCHANGE_COPY.detail;
  let detail;
  let member = null;
  let inviteUrl: string | null = null;
  try {
    detail = await getOrganiserExchange(id, viewerId);
    // WHY only when not the organiser: a member's page has no token and no organiser tools (GC-013, AC-24).
    if (!detail) member = await getMemberExchange(id, viewerId);
    // WHY here: the link is built on the server from SITE_URL and the token, and goes only to the
    // organiser's invite section. A closed exchange has no link worth sharing.
    if (detail?.exchange.isOpen) inviteUrl = await buildInviteUrl(detail.inviteToken);
  } catch {
    return <LoadError>{copy.loadError}</LoadError>;
  }

  // S47 / GC-029: a missing, cancelled or someone else's exchange all get this same state, which
  // never names the exchange or confirms it exists. No exchange data is in the page.
  if (!detail && !member) return <NotAvailable />;

  const timeZone = await readViewerTimeZone();
  if (member) return <ExchangeMemberView exchange={member} timeZone={timeZone} />;
  if (!detail) return <NotAvailable />;
  return <ExchangeJustStarted exchange={detail.exchange} inviteUrl={inviteUrl} timeZone={timeZone} />;
}
