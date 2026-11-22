import { firstName } from "@/features/joining/copy";
import { LocalDateTime } from "@/components/ui/LocalDateTime";
import { Timeline } from "@/components/ui/Timeline";
import { formatDay, zoneShortName } from "@/lib/dates/format";
import { budgetLabel } from "@/lib/money/budget";
import { EXCHANGE_COPY } from "../copy";
import { peopleIn } from "../people";
import { lastJoinDay, timelineSteps } from "../timeline";
import type { OrganiserExchange } from "../types";
import { JoinRequestBlock } from "@/features/participants/components/JoinRequestBlock";
import { ReadinessBlock } from "@/features/participants/components/ReadinessBlock";
import { NUDGE_COPY } from "@/features/participants/copy";
import { summariseReadiness } from "@/features/participants/readiness";
import type { ReadinessRow } from "@/features/participants/types";
import type { ExclusionsEntry } from "@/features/exclusions/types";
import { cx } from "@/components/ui/cx";
import { ExchangeDetailHeader } from "./ExchangeDetailHeader";
import { InviteSection } from "./InviteSection";
import { JoiningClosedCard } from "./JoiningClosedCard";
import { OrganiserTools } from "./OrganiserTools";
import { PeopleSection } from "./PeopleSection";
import { YourPart } from "./YourPart";

type Props = {
  exchange: OrganiserExchange;
  /** Null once joining has closed: there is nothing left to share. Organiser-only (GCO-004). */
  inviteUrl: string | null;
  /** The viewer's own zone. */
  timeZone: string;
  /** Names of people waiting to be let in, oldest first. Organiser-only (GCO-007). */
  waitingNames: readonly string[];
  /** Who is taking part and whose wishlist is in. Organiser-only (GCO-006). Null when it could not be read: the page then shows what it showed before readiness. */
  readiness: readonly ReadinessRow[] | null;
  /** The organiser's own display name, for the nudge preview. */
  organiserName: string;
  /** Null when pairs cannot be set any more: no Exclusions row (GCO-009). Organiser-only. */
  exclusions: ExclusionsEntry | null;
};

// S14 Exchange-Detail-started (GC-013, GCO-004) with the owner's decisions of 2026-11-09: header
// "Only you so far.", no separate Dates section, no note, the time zone line under "What happens
// next", and no control whose feature is not built yet (Invite by email, Edit, Draw, Cancel). Slice 5
// adds Your part (S49 row), People and Organiser tools > Invite people (boards Exchange-Detail-oattached,
// -oideas, -ostarted, Org-People-default; owner Q14).
export function ExchangeJustStarted({ exchange, inviteUrl, timeZone, waitingNames, readiness, organiserName, exclusions }: Props) {
  const copy = EXCHANGE_COPY.detail;
  // WHY others, not the count: "alone" is about people other than the viewer, who may only be organising.
  const others = exchange.people.filter((p) => !p.isMe);
  const alone = others.length === 0;
  const drawDay =
    exchange.drawMode === "at_join_by" && exchange.drawAt ? formatDay(new Date(exchange.drawAt), timeZone) : null;
  // WHY only while people can still be managed: nudging is for before the draw (GCO-008). The database refuses it after.
  const summary = readiness && exchange.canManagePeople ? summariseReadiness(readiness) : null;
  const nudge = NUDGE_COPY;
  // Boards Exchange-Detail-obefore and -ojust: the header leads with readiness once someone else is in.
  const headerLine =
    summary && !alone
      ? `${exchange.takingPart ? nudge.headerWishlists(summary.inCount, summary.total) : nudge.headerPeople(summary.total)} ${
          drawDay ? nudge.headerDrawOn(drawDay) : nudge.headerDrawManual
        }`
      : alone
        ? copy.onlyYou
        : EXCHANGE_COPY.list.rowPeople(peopleIn(exchange.takingPart, exchange.peopleCount));
  const showReadiness = summary !== null && summary.missing.length > 0;
  const showRequests = waitingNames.length > 0;
  return (
    <div className="flex flex-col gap-32 md:max-w-reading-max">
      <ExchangeDetailHeader name={exchange.name} tint={exchange.tint}>
        <p className="text-body-base-regular text-text-default">{headerLine}</p>
        <p className="text-body-sm-regular text-text-muted">
          Created by you on <LocalDateTime value={exchange.createdAt} timeZone={timeZone} /> ·{" "}
          {copy.spends(budgetLabel(exchange.budget))}
        </p>
      </ExchangeDetailHeader>

      {/* WHY first (owner Q17): a person waiting is the thing that needs the organiser now, ahead of the invite
          link or the closed card. Readiness sits beside it on desktop (board Exchange-Detail-obefore-d). */}
      {showRequests || showReadiness ? (
        <div className={cx("flex flex-col gap-32", showRequests && showReadiness && "md:grid md:grid-cols-2 md:items-stretch")}>
          {showRequests ? (
            <JoinRequestBlock
              exchangeId={exchange.id}
              names={waitingNames}
              lastJoinDay={lastJoinDay(exchange, timeZone)}
              joiningOpen={exchange.isOpen}
            />
          ) : null}
          {showReadiness ? (
            <ReadinessBlock
              exchangeId={exchange.id}
              exchangeName={exchange.name}
              organiserFirst={firstName(organiserName)}
              drawDay={drawDay}
              inNames={summary.inNames}
              inCount={summary.inCount}
              total={summary.total}
              missingNames={summary.missing.map((m) => m.name)}
              targets={summary.targets}
            />
          ) : null}
        </div>
      ) : null}

      {inviteUrl ? (
        <InviteSection exchangeName={exchange.name} lastJoinDay={lastJoinDay(exchange, timeZone)} inviteUrl={inviteUrl} />
      ) : !exchange.isOpen ? (
        // WHY lowest priority (owner, 2026-11-14): this card shows only when no other card applies. Slice 10's
        // draw and readiness cards take this slot first; add them above this branch.
        <JoiningClosedCard />
      ) : null}

      <section aria-labelledby="next-heading" className="flex flex-col gap-20 rounded-2xl bg-surface-subtle p-24">
        <h2 id="next-heading" className="text-heading-4">
          {copy.nextTitle}
        </h2>
        <Timeline steps={timelineSteps(exchange, timeZone)} />
        {/* WHY the zone at join-by: the gift day has no time, so join-by and draw are the only times shown. */}
        <p className="text-body-sm-regular text-text-muted">{copy.zoneLine(zoneShortName(new Date(exchange.joinByAt), timeZone))}</p>
      </section>

      {exchange.myList ? (
        <YourPart mode="organiser" exchangeId={exchange.id} list={exchange.myList} drawDay={drawDay} />
      ) : (
        <section aria-labelledby="part-heading" className="flex flex-col gap-8">
          <h2 id="part-heading" className="text-heading-4">
            {copy.yourPart}
          </h2>
          <p className="text-body-base-regular text-text-secondary">{copy.justOrganising}</p>
        </section>
      )}

      <PeopleSection
        people={exchange.takingPart ? exchange.people : others}
        alone={alone}
        count={peopleIn(exchange.takingPart, exchange.peopleCount)}
        seeAllHref={`/exchanges/${exchange.id}/participants`}
      />

      {inviteUrl || exclusions ? (
        <OrganiserTools
          exchangeId={exchange.id}
          exchangeName={exchange.name}
          lastJoinDay={lastJoinDay(exchange, timeZone)}
          inviteUrl={inviteUrl}
          approvalRequired={exchange.approvalRequired}
          waitingNames={waitingNames}
          exclusions={exclusions}
        />
      ) : null}
    </div>
  );
}
