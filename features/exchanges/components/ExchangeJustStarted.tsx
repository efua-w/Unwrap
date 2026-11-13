import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { LocalDateTime } from "@/components/ui/LocalDateTime";
import { Timeline } from "@/components/ui/Timeline";
import { zoneShortName } from "@/lib/dates/format";
import { budgetLabel } from "@/lib/money/budget";
import { EXCHANGE_COPY } from "../copy";
import { lastJoinDay, timelineSteps } from "../timeline";
import type { OrganiserExchange } from "../types";
import { InviteSection } from "./InviteSection";

type Props = {
  exchange: OrganiserExchange;
  /** Null once joining has closed: there is nothing left to share. Organiser-only (GCO-004). */
  inviteUrl: string | null;
  /** The viewer's own zone. */
  timeZone: string;
};

// S14 Exchange-Detail-started (GC-013, GCO-004) with the owner's decisions of 2026-11-09: header
// "Only you so far.", no separate Dates section, no note, the time zone line under "What happens
// next", and no control whose feature is not built yet (Invite by email, Add your wishlist,
// Organiser tools, Cancel). Those arrive with slices 5, 7, 10, 13 and 15.
export function ExchangeJustStarted({ exchange, inviteUrl, timeZone }: Props) {
  const copy = EXCHANGE_COPY.detail;
  return (
    <div className="flex flex-col gap-32 md:max-w-reading-max">
      {/* Boards Exchange-Detail-ostarted -m/-d: the tag sits above the title, all left-aligned. */}
      <header className="flex flex-col items-start gap-12">
        <ExchangeTag name={exchange.name} tint={exchange.tint} size="header" />
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="break-words text-heading-2">{exchange.name}</h1>
          <p className="text-body-base-regular text-text-default">
            {exchange.peopleCount <= 1 ? copy.onlyYou : EXCHANGE_COPY.list.rowPeople(exchange.peopleCount)}
          </p>
          <p className="text-body-sm-regular text-text-muted">
            Created by you on <LocalDateTime value={exchange.createdAt} timeZone={timeZone} /> ·{" "}
            {copy.spends(budgetLabel(exchange.budget))}
          </p>
        </div>
      </header>

      {inviteUrl ? (
        <InviteSection exchangeName={exchange.name} lastJoinDay={lastJoinDay(exchange, timeZone)} inviteUrl={inviteUrl} />
      ) : null}

      <section aria-labelledby="next-heading" className="flex flex-col gap-20 rounded-2xl bg-surface-subtle p-24">
        <h2 id="next-heading" className="text-heading-4">
          {copy.nextTitle}
        </h2>
        <Timeline steps={timelineSteps(exchange, timeZone)} />
        {/* WHY the zone at join-by: the gift day has no time, so join-by and draw are the only times shown. */}
        <p className="text-body-sm-regular text-text-muted">{copy.zoneLine(zoneShortName(new Date(exchange.joinByAt), timeZone))}</p>
      </section>

      <section aria-labelledby="part-heading" className="flex flex-col gap-8">
        <h2 id="part-heading" className="text-heading-4">
          {copy.yourPart}
        </h2>
        <p className="text-body-base-regular text-text-secondary">{exchange.takingPart ? copy.takingPart : copy.justOrganising}</p>
      </section>

      <section aria-labelledby="people-heading" className="flex flex-col gap-8">
        <h2 id="people-heading" className="text-heading-4">
          {copy.people}
        </h2>
        <p className="text-body-base-regular text-text-secondary">{copy.peopleOnlyYou}</p>
      </section>
    </div>
  );
}
