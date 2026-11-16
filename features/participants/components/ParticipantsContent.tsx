import { cx } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { NotAvailable } from "@/features/exchanges/components/NotAvailable";
import { getOrganiserExchange } from "@/features/exchanges/queries";
import { lastJoinDay } from "@/features/exchanges/timeline";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";
import { buildInviteUrl } from "@/lib/site-url";
import { PARTICIPANTS_COPY } from "../copy";
import { askedLabel } from "../format";
import { getJoinRequestsWithEmail, getParticipants } from "../queries";
import { ParticipantsView } from "./ParticipantsView";

function Heading({ sub }: { sub?: string }) {
  return (
    <header className="flex flex-col gap-8">
      <h1 id="participants-heading" tabIndex={-1} className="text-heading-1 focus:outline-none md:text-heading-2">
        {PARTICIPANTS_COPY.title}
      </h1>
      {sub ? <p className="break-words text-body-base-regular text-text-secondary">{sub}</p> : null}
    </header>
  );
}

// Board Org-People-loading: the header, then five person rows. WHY the subtitle is a skeleton line: this runs
// before the exchange is read, so its name and count are not known yet.
export function ParticipantsLoading() {
  return (
    <SkeletonRegion>
      <Heading />
      <Skeleton shape="line" text="base" className="w-2/3" />
      <ul aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className={cx("flex min-h-row items-center gap-12", i > 0 && "border-t-1 border-border-subtle")}>
            <span className="size-48 shrink-0 animate-pulse rounded-xl bg-surface-muted motion-reduce:animate-none" />
            <span className="flex flex-1 flex-col gap-8">
              <span className="h-16 w-3/5 animate-pulse rounded-full bg-surface-muted motion-reduce:animate-none" />
              <span className="h-12 w-2/5 animate-pulse rounded-full bg-surface-muted motion-reduce:animate-none" />
            </span>
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}

// S30 Participants (GCO-007). WHY the organiser guard is getOrganiserExchange: it answers null for a missing,
// cancelled, someone else's or member-only exchange alike, so every non-organiser gets the same S47 page and
// learns nothing (AC-12). The database enforces it again in each function this page calls.
export async function ParticipantsContent({ id, viewerId }: { id: string; viewerId: string }) {
  const copy = PARTICIPANTS_COPY;
  let detail;
  try {
    detail = await getOrganiserExchange(id, viewerId);
  } catch {
    return (
      <div className="flex flex-col gap-24 md:max-w-reading-max">
        <Heading />
        <LoadError>{copy.loadErrorUnnamed}</LoadError>
      </div>
    );
  }
  if (!detail) return <NotAvailable />;
  const { exchange } = detail;

  let people;
  let requests;
  let inviteUrl: string | null = null;
  try {
    [people, requests] = await Promise.all([getParticipants(id), getJoinRequestsWithEmail(id)]);
    // WHY only while open: "Invite more people" needs a link worth sharing (the same rule as the exchange page).
    if (exchange.isOpen) inviteUrl = await buildInviteUrl(detail.inviteToken);
  } catch {
    return (
      <div className="flex flex-col gap-24 md:max-w-reading-max">
        <Heading sub={copy.errorSubtitle(exchange.name)} />
        <LoadError>{copy.loadError(exchange.name)}</LoadError>
      </div>
    );
  }

  const timeZone = await readViewerTimeZone();
  const now = new Date();
  const alone = people.every((p) => p.isMe);
  // WHY the subtitle checks the list: "Only you so far" is wrong when the organiser is just organising and
  // nobody is in yet; then there is no subtitle (reviewer R1-7).
  const subtitle = !alone
    ? copy.subtitle(exchange.name, people.length)
    : people.some((p) => p.isMe)
      ? copy.subtitleAlone(exchange.name)
      : undefined;
  return (
    <div className="flex flex-col gap-32 md:max-w-reading-max">
      <Heading sub={subtitle} />
      <ParticipantsView
        exchangeId={exchange.id}
        exchangeName={exchange.name}
        requests={requests.map((r) => ({ requestId: r.requestId, name: r.name, email: r.email, askedLabel: askedLabel(r.requestedAt, now, timeZone) }))}
        people={people}
        alone={alone}
        lastJoinDay={lastJoinDay(exchange, timeZone)}
        inviteUrl={inviteUrl}
        approvalRequired={exchange.approvalRequired}
        canManage={exchange.canManagePeople}
      />
    </div>
  );
}
