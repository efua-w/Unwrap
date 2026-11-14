import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeading } from "@/components/layout/PageHeading";
import { Button } from "@/components/ui/Button";
import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { ListRow } from "@/components/ui/ListRow";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { ExchangeBlock } from "@/features/exchanges/components/ExchangeBlock";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { listMyExchanges } from "@/features/exchanges/queries";
import type { ExchangeListItem } from "@/features/exchanges/types";
import { peopleIn, joinedToday } from "@/features/exchanges/people";
import { HowItWorks } from "@/features/onboarding/HowItWorks";
import { requireProfile } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates/format";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";

type SearchParams = Promise<{ view?: string | string[] }>;

// S08 Exchanges (GC-008). Boards: Exchanges-first, -started, -active, -joined, -pastempty, -loading, -error,
// -offline (m and d). Slices 4 and 5: exchanges the person organises or has joined; pending and closed-request
// rows and the personal action arrive with slices 6 to 10.
export default async function ExchangesPage({ searchParams }: { searchParams: SearchParams }) {
  const { view } = await searchParams;
  const past = view === "past";
  const profile = await requireProfile(past ? "/exchanges?view=past" : "/exchanges");
  return (
    <AppShell profile={{ name: profile.displayName }} top="heading">
      <div className="flex flex-col gap-24 md:max-w-reading-max">
        <PageHeading profile={{ name: profile.displayName }}>{EXCHANGE_COPY.list.title}</PageHeading>
        <Suspense fallback={<ExchangesLoading />}>
          <ExchangesContent viewerId={profile.id} past={past} />
        </Suspense>
      </div>
    </AppShell>
  );
}

function Tabs({ past }: { past: boolean }) {
  const copy = EXCHANGE_COPY.list;
  return (
    <SegmentedTabs
      kind="links"
      label={copy.tabsLabel}
      items={[
        { label: copy.active, href: "/exchanges", current: !past },
        { label: copy.past, href: "/exchanges?view=past", current: past },
      ]}
    />
  );
}

// Board Exchanges-loading: rows stand in for the list.
function ExchangesLoading() {
  return (
    <SkeletonRegion>
      <Skeleton shape="row" />
      <Skeleton shape="row" />
      <Skeleton shape="row" />
    </SkeletonRegion>
  );
}

// GC-008: one written sentence per row (boards Exchanges-joined, Exchanges-active). "Names are drawn {date}."
// names the draw day in the viewer's zone; the organiser-draws variants are pending copy. Before the draw
// there are no readiness counts (slice 8), so an organiser's row says how many people are in.
function rowSub(item: ExchangeListItem, timeZone: string): string {
  const copy = EXCHANGE_COPY.list;
  const when =
    item.drawMode === "at_join_by" && item.drawAt
      ? copy.rowNamesDrawn(formatDay(new Date(item.drawAt), timeZone))
      : item.isOrganiser
        ? copy.rowNamesDrawnManualOrganiser
        : copy.rowNamesDrawnManualMember;
  if (!item.isOrganiser) {
    return joinedToday(item.joinedAt, new Date(), timeZone) ? copy.rowJoinedToday(when) : copy.rowJoined(when);
  }
  const others = item.peopleCount - 1;
  if (others <= 0) return item.takingPart ? copy.rowOnlyYouTaking : copy.rowOnlyYouOrganising;
  const n = peopleIn(item.takingPart, item.peopleCount);
  return item.takingPart ? copy.rowCreated(n, when) : copy.rowJustOrganisingPeople(n, when);
}

async function ExchangesContent({ viewerId, past }: { viewerId: string; past: boolean }) {
  const copy = EXCHANGE_COPY.list;
  let items: ExchangeListItem[];
  try {
    items = await listMyExchanges(viewerId);
  } catch {
    return (
      <>
        <Tabs past={past} />
        <LoadError>{copy.loadError}</LoadError>
      </>
    );
  }

  // Board Exchanges-first: no tabs until there is something to switch between.
  if (items.length === 0 && !past) {
    return (
      <div className="flex flex-col gap-24">
        <HowItWorks headingId="how">
          <Button href="/exchanges/new" icon={Plus} fullWidth>
            {copy.start}
          </Button>
        </HowItWorks>
        <p className="text-body-sm-regular text-text-muted">{copy.inviteHelp}</p>
      </div>
    );
  }

  const shown = items.filter((item) => item.isPast === past);
  if (past && shown.length === 0) {
    return (
      <>
        <Tabs past={past} />
        <p className="py-16 text-body-sm-regular text-text-muted">{copy.pastEmpty}</p>
      </>
    );
  }

  // Dates in the viewer's own zone (product rules).
  const timeZone = await readViewerTimeZone();
  // GCO-004 B: the newest exchange where the organiser is still the only one in leads with its invite link.
  const block = past ? undefined : shown.find((item) => item.isOrganiser && item.peopleCount === 1);
  return (
    <>
      <Tabs past={past} />
      {block ? <ExchangeBlock item={block} timeZone={timeZone} /> : null}
      <ul aria-label={copy.title} className="flex flex-col">
        {shown.map((item, index) => (
          <ListRow
            key={item.id}
            href={`/exchanges/${item.id}`}
            leading={<ExchangeTag name={item.name} tint={item.tint} />}
            title={item.name}
            sub={rowSub(item, timeZone)}
            divider={index > 0}
          />
        ))}
      </ul>
      {past ? null : (
        <div>
          {/* GC-008: primary, unless an organiser block above already shows a primary button. */}
          <Button href="/exchanges/new" icon={Plus} variant={block ? "secondary" : "primary"} fullWidth className="md:w-auto">
            {copy.start}
          </Button>
        </div>
      )}
    </>
  );
}
