import { Envelope, Gift, Plus } from "@phosphor-icons/react/dist/ssr";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeading } from "@/components/layout/PageHeading";
import { ActionCard, type ActionCardPlacement } from "@/components/ui/ActionCard";
import { Button } from "@/components/ui/Button";
import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { ListRow } from "@/components/ui/ListRow";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { ExchangeBlock } from "@/features/exchanges/components/ExchangeBlock";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { getExchangeStates, listMyExchanges } from "@/features/exchanges/queries";
import type { ExchangeListItem } from "@/features/exchanges/types";
import type { MyPendingRequest } from "@/features/participants/types";
import { peopleIn, joinedToday } from "@/features/exchanges/people";
import { lastJoinDay } from "@/features/exchanges/timeline";
import { firstName } from "@/features/joining/copy";
import { JoinRequestBlock } from "@/features/participants/components/JoinRequestBlock";
import { getJoinRequests, listMyPendingRequests } from "@/features/participants/queries";
import { DRAW_COPY } from "@/features/draw/copy";
import { DismissRequestButton } from "@/features/draw/components/DismissRequestButton";
import { getMyAssignment } from "@/features/draw/queries";
import { HowItWorks } from "@/features/onboarding/HowItWorks";
import { requireProfile } from "@/lib/auth/session";
import { formatDay, formatYmdDay } from "@/lib/dates/format";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";

type SearchParams = Promise<{ view?: string | string[] }>;

// S08 Exchanges (GC-008). Boards: Exchanges-first, -started, -active, -joined, -pastempty, -loading, -error,
// -offline (m and d). Slices 4 to 6: exchanges the person organises or has joined, the organiser's request
// blocks and the asker's pending rows. Slice 10 adds the drawn row line, the reveal ActionCard and the closed-request row
// with Dismiss (GC-006, owner Q4 and Q5, 2026-11-22).
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
function rowSub(item: ExchangeListItem, timeZone: string, drawn: boolean): string {
  const copy = EXCHANGE_COPY.list;
  // Board Exchanges-active: "Names are drawn. Gifts on Sat 19 Dec." once names are drawn.
  if (drawn) return DRAW_COPY.rowDrawn(formatYmdDay(item.giftDay) ?? "");
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
  let myRequests: MyPendingRequest[];
  let waiting: Map<string, string[]>;
  try {
    [items, myRequests] = await Promise.all([listMyExchanges(viewerId), past ? [] : listMyPendingRequests()]);
    // WHY organiser's active exchanges only (GCO-006): the database gives anyone else an empty list, and a past
    // exchange has nothing left to decide.
    const organised = past ? [] : items.filter((item) => item.isOrganiser && !item.isPast);
    const lists = await Promise.all(organised.map((item) => getJoinRequests(item.id)));
    waiting = new Map(organised.map((item, i) => [item.id, (lists[i] ?? []).map((r) => r.name)]));
  } catch {
    return (
      <>
        <Tabs past={past} />
        <LoadError>{copy.loadError}</LoadError>
      </>
    );
  }

  // Board Exchanges-first: no tabs until there is something to switch between.
  // WHY pending requests count as content (Q17): a person whose only exchange is a request is not a first-timer.
  if (items.length === 0 && myRequests.length === 0 && !past) {
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

  // GC-008, GC-013: which exchanges are drawn, and the first one whose giver has not revealed yet gets the ActionCard. WHY an
  // assignment read per drawn exchange and not a list: each is the caller's own row (id and flag, no name), and a read that
  // fails only loses the card, never the list.
  const states = past ? new Map<string, string>() : await getExchangeStates(shown.map((item) => item.id));
  const isDrawn = (item: ExchangeListItem) => states.get(item.id) === "drawn";
  const drawnTaking = past ? [] : shown.filter((item) => isDrawn(item) && item.takingPart);
  const assignments = await Promise.all(drawnTaking.map((item) => getMyAssignment(item.id).catch(() => null)));
  const unrevealed = drawnTaking.find((_, i) => assignments[i] && !assignments[i].revealed);

  // Dates in the viewer's own zone (product rules).
  const timeZone = await readViewerTimeZone();
  // GCO-006 / Q17: an exchange with people waiting leads with its request block, and that wins over "Only you
  // so far" for the same exchange. GCO-004 B: the newest exchange where the organiser is still the only one in
  // leads with its invite link. At most two blocks (story GC-008), requests first.
  const requestItems = shown.filter((item) => (waiting.get(item.id)?.length ?? 0) > 0);
  const now = new Date();
  // WHY the join-by check: once joining has closed nobody can use the link, so the block would ask for
  // something impossible. Hidden, not replaced; the exchange page shows "Joining has closed" (owner
  // request 2026-11-15, GCO-004).
  const aloneItem = past
    ? undefined
    : shown.find(
        (item) => item.isOrganiser && item.peopleCount === 1 && !requestItems.includes(item) && new Date(item.joinByAt) > now,
      );
  const blocks = [
    ...requestItems.map((item) => ({ kind: "requests" as const, item })),
    ...(aloneItem ? [{ kind: "alone" as const, item: aloneItem }] : []),
  ].slice(0, 2);
  const pendingRequests = myRequests.filter((r) => r.status === "pending");
  const closedRequests = myRequests.filter((r) => r.status === "closed");
  // WHY two placements: a banner first and a tray last, so the focus order matches what is on screen at each size (WCAG 2.4.3).
  const card = (placement: ActionCardPlacement) =>
    unrevealed ? (
      <ActionCard
        label={DRAW_COPY.needsYou}
        placement={placement}
        icon={Gift}
        title={DRAW_COPY.rowCardTitle(unrevealed.name)}
        sub={DRAW_COPY.rowCardSub}
        action={
          <Button variant="brand" icon={Envelope} href={`/exchanges/${unrevealed.id}/reveal`} fullWidth className="md:w-auto">
            {DRAW_COPY.reveal}
          </Button>
        }
      />
    ) : null;
  return (
    <>
      {card("banner")}
      <Tabs past={past} />
      {blocks.map(({ kind, item }) =>
        kind === "alone" ? (
          <ExchangeBlock key={`alone-${item.id}`} item={item} timeZone={timeZone} />
        ) : (
          <JoinRequestBlock
            key={`requests-${item.id}`}
            exchangeId={item.id}
            names={waiting.get(item.id) ?? []}
            lastJoinDay={lastJoinDay(item, timeZone)}
            // WHY the join-by instant: the list has no status, and joining is open exactly until it.
            joiningOpen={new Date(item.joinByAt) > now}
            exchange={{ name: item.name, tint: item.tint }}
          />
        ),
      )}
      <ul aria-label={copy.title} className="flex flex-col">
        {shown.map((item, index) => (
          <ListRow
            key={item.id}
            href={`/exchanges/${item.id}`}
            leading={<ExchangeTag name={item.name} tint={item.tint} />}
            title={item.name}
            sub={rowSub(item, timeZone, isDrawn(item))}
            divider={index > 0}
          />
        ))}
        {/* GC-008 Q7: requests still waiting. Not links: there is nothing to open until the organiser decides. */}
        {pendingRequests.map((request, index) => (
          <ListRow
            key={request.requestId}
            leading={<ExchangeTag name={request.exchangeName} tint={request.exchangeTint} />}
            title={request.exchangeName}
            sub={copy.rowRequestSent(firstName(request.organiserName))}
            divider={shown.length + index > 0}
          />
        ))}
        {/* GC-006 (owner Q5): the draw closed these. Dismiss is a sibling target of the row, never inside it. */}
        {closedRequests.map((request, index) => (
          <ListRow
            key={request.requestId}
            leading={<ExchangeTag name={request.exchangeName} tint={request.exchangeTint} />}
            title={request.exchangeName}
            sub={DRAW_COPY.closedRequest(firstName(request.organiserName))}
            action={<DismissRequestButton requestId={request.requestId} exchangeName={request.exchangeName} />}
            divider={shown.length + pendingRequests.length + index > 0}
          />
        ))}
      </ul>
      {past ? null : (
        <div>
          {/* GC-008: primary, unless an organiser block above already shows a primary button. */}
          <Button href="/exchanges/new" icon={Plus} variant={blocks.length > 0 ? "secondary" : "primary"} fullWidth className="md:w-auto">
            {copy.start}
          </Button>
        </div>
      )}
      {card("tray")}
    </>
  );
}
