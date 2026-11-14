import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { DetailRows } from "@/features/joining/components/DetailRows";
import { firstName, JOIN_COPY } from "@/features/joining/copy";
import { formatDay, formatDayTime, formatTime, formatYmdDay, zoneShortName } from "@/lib/dates/format";
import { budgetLabel } from "@/lib/money/budget";
import { EXCHANGE_COPY } from "../copy";
import type { MemberExchange } from "../types";
import { PeopleSection } from "./PeopleSection";
import { YourPart } from "./YourPart";

type Props = {
  exchange: MemberExchange;
  /** The viewer's own zone. */
  timeZone: string;
};

// S14 participant view before the draw (GC-013). Boards: Exchange-Detail-before and -nolist (m, d). Left out
// on purpose: the invite link (organiser-only, AC-24), Leave exchange (slice 14), the "Add your wishlist"
// action card (slice 10, owner Q12), and any list status of other people (AC-20). WHY no "not available"
// here: the page only renders this for an active member.
export function ExchangeMemberView({ exchange, timeZone }: Props) {
  const copy = EXCHANGE_COPY.detail;
  const manual = exchange.drawMode === "organiser_chooses" || exchange.drawAt === null;
  const organiserFirst = firstName(exchange.organiserName);
  const drawAt = exchange.drawAt ? new Date(exchange.drawAt) : null;
  const drawDay = !manual && drawAt ? formatDay(drawAt, timeZone) : null;
  const hasList = exchange.myList.source !== "none";

  return (
    <div className="flex flex-col gap-32 md:max-w-reading-max">
      <header className="flex flex-col items-start gap-12">
        <ExchangeTag name={exchange.name} tint={exchange.tint} size="header" />
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="break-words text-heading-2">{exchange.name}</h1>
          <p className="text-body-base-regular text-text-default">
            {drawDay ? copy.namesDrawnOn(drawDay) : copy.namesDrawnWhenReady(organiserFirst)}
          </p>
          <p className="text-body-sm-regular text-text-muted">
            {copy.organisedBy(exchange.organiserName)} · {copy.spends(budgetLabel(exchange.budget))}
          </p>
        </div>
      </header>

      {hasList ? (
        <section aria-labelledby="set-heading" className="flex flex-col gap-8">
          <h2 id="set-heading" className="text-heading-4">
            {copy.allSetTitle}
          </h2>
          <p className="text-body-sm-regular text-text-secondary">
            {!manual && drawAt ? copy.allSetBody(`${formatDay(drawAt, timeZone)} at ${formatTime(drawAt, timeZone)}`) : copy.allSetBodyManual}
          </p>
        </section>
      ) : null}

      <YourPart mode="participant" exchangeId={exchange.id} list={exchange.myList} drawDay={drawDay} />

      <section aria-labelledby="dates-heading" className="flex flex-col gap-4">
        <h2 id="dates-heading" className="text-heading-4">
          {copy.datesTitle}
        </h2>
        <DetailRows
          rows={[
            { label: copy.joinByLabel, value: formatDayTime(new Date(exchange.joinByAt), timeZone) },
            {
              label: copy.namesDrawnLabel,
              value: !manual && drawAt ? formatDayTime(drawAt, timeZone) : JOIN_COPY.drawWhenReady(organiserFirst),
            },
            { label: copy.giftsLabel, value: formatYmdDay(exchange.giftDay) ?? "" },
          ]}
          zoneLine={copy.zoneLine(zoneShortName(new Date(exchange.joinByAt), timeZone))}
        />
      </section>

      <PeopleSection people={exchange.people} alone={false} count={exchange.people.length} />

      {exchange.note ? (
        <section aria-labelledby="note-heading" className="flex flex-col gap-8 rounded-2xl bg-surface-subtle p-16">
          <h2 id="note-heading" className="text-body-base-semibold">
            {copy.fromOrganiser(organiserFirst)}
          </h2>
          <p className="whitespace-pre-line break-words text-body-base-regular text-text-secondary">{exchange.note}</p>
        </section>
      ) : null}
    </div>
  );
}
