import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { LocalDateTime } from "@/components/ui/LocalDateTime";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { lastJoinDay } from "@/features/exchanges/timeline";
import { formatYmdDay, zoneShortName } from "@/lib/dates/format";
import { budgetLabel } from "@/lib/money/budget";
import { JOIN_COPY, INVITE_COPY, firstName } from "../copy";
import type { JoinDetails } from "../types";
import { DetailRows } from "./DetailRows";

// S10 Join confirmation content (GC-009): the first screen to show faces and names. Boards:
// Joining-Confirm-default, -alone (m, d). WHY `email` is a prop of the viewer's own session and the
// people list has names only: no other person's email, id or list status reaches this component.
export function JoinContent({
  details,
  viewerName,
  viewerEmail,
  timeZone,
}: {
  details: JoinDetails;
  viewerName: string;
  viewerEmail: string | null;
  timeZone: string;
}) {
  const organiser = firstName(details.organiserName);
  const budget = budgetLabel(details.budget);
  const manual = details.drawMode === "organiser_chooses" || details.drawAt === null;
  const onlyOrganiser = details.people.length === 1 && details.people[0]?.isOrganiser === true;
  const schedule = {
    joinByAt: details.joinByAt,
    drawMode: details.drawMode,
    drawAt: details.drawAt,
    giftDay: details.giftDay,
    // WHY false: lastJoinDay reads the join-by and draw mode only.
    approvalRequired: false,
  };
  return (
    <>
      <div className="flex flex-col gap-12">
        <ExchangeTag name={details.exchangeName} tint={details.tint} size="header" />
        <div className="flex flex-col gap-4">
          <h1 className="break-words text-heading-1">{details.exchangeName}</h1>
          <p className="text-body-sm-regular text-text-secondary">{JOIN_COPY.organisedBy(details.organiserName)}</p>
        </div>
      </div>

      <section aria-labelledby="whos-in-heading" className="flex flex-col gap-8">
        <h2 id="whos-in-heading" className="text-body-base-semibold">
          {JOIN_COPY.whosIn(details.people.length)}
        </h2>
        <AvatarStack
          people={details.people.map((p, i) => ({ id: String(i), name: p.name }))}
          label={JOIN_COPY.stackLabel(details.people)}
        />
        <p className="break-words text-body-sm-regular text-text-secondary">
          {onlyOrganiser ? JOIN_COPY.onlyOrganiser(organiser) : JOIN_COPY.peopleLine(details.people)}
        </p>
      </section>

      <DetailRows
        zoneLine={INVITE_COPY.zoneLine(zoneShortName(new Date(details.joinByAt), timeZone))}
        rows={[
          { label: INVITE_COPY.budget, value: budget },
          {
            label: INVITE_COPY.joinBy,
            value: manual ? (
              EXCHANGE_COPY.flow.rules.endOfDay(lastJoinDay(schedule, timeZone))
            ) : (
              <LocalDateTime value={details.joinByAt} timeZone={timeZone} format="dayTime" />
            ),
          },
          {
            label: INVITE_COPY.namesDrawn,
            value:
              manual || details.drawAt === null ? (
                JOIN_COPY.drawWhenReady(organiser)
              ) : (
                <LocalDateTime value={details.drawAt} timeZone={timeZone} format="dayTime" />
              ),
          },
          { label: INVITE_COPY.giftsExchanged, value: formatYmdDay(details.giftDay) ?? details.giftDay },
        ]}
      />

      {details.note ? (
        <section aria-labelledby="note-heading" className="flex flex-col gap-4">
          <h2 id="note-heading" className="text-body-base-semibold">
            {JOIN_COPY.from(organiser)}
          </h2>
          <p className="whitespace-pre-wrap break-words text-body-sm-regular text-text-secondary">{details.note}</p>
        </section>
      ) : null}

      <section aria-labelledby="agreeing-heading" className="flex flex-col gap-8">
        <h2 id="agreeing-heading" className="text-heading-4">
          {JOIN_COPY.agreeing.title}
        </h2>
        <ul className="flex list-disc flex-col gap-6 pl-20 text-body-sm-regular text-text-secondary">
          <li>{JOIN_COPY.agreeing.wishlist}</li>
          <li>{JOIN_COPY.agreeing.buy(budget)}</li>
          <li>{JOIN_COPY.agreeing.bring}</li>
        </ul>
        <Alert variant="privacy">{INVITE_COPY.privacy(organiser)}</Alert>
      </section>

      <div className="flex items-center gap-12">
        <Avatar name={viewerName} size="nav" decorative />
        <p className="min-w-0 break-words text-body-sm-regular text-text-secondary">
          {JOIN_COPY.joiningAs}{" "}
          <span className="font-semibold text-text-default">{viewerEmail ? `${viewerName}, ${viewerEmail}` : viewerName}</span>
        </p>
      </div>
    </>
  );
}
