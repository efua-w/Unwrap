import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { ExchangeTag, type ExchangeTint } from "@/components/ui/ExchangeTag";
import { LocalDateTime } from "@/components/ui/LocalDateTime";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { lastJoinDay } from "@/features/exchanges/timeline";
import { formatDay, formatYmdDay, zoneShortName } from "@/lib/dates/format";
import { budgetLabel, type BudgetPreset } from "@/lib/money/budget";
import { INVITE_COPY, JOIN_COPY, firstName, joinedCountLine } from "../copy";
import type { JoinPerson } from "../types";
import { DetailRows } from "./DetailRows";

// S10 Join exchange, the one screen before joining (GC-002, GC-009; owner request 2026-11-18). Boards:
// Join-Exchange-guest, -default, -alone, -approval (m, d). The facts are the same signed out and signed in;
// only the audience differs.
//
// WHY `audience` is a union and not optional fields (core security rule, owner decision 1, 2026-11-18): the
// signed-out branch has no field for a face, a name, the note or an email, so the public preview cannot
// pass one in. Signed in, `viewerEmail` is the viewer's OWN address and the people list has names only: no
// other person's email, id or list status reaches this component.
export type JoinFacts = {
  exchangeName: string;
  tint: ExchangeTint;
  /** The organiser, who is also the inviter. */
  organiserName: string;
  budget: BudgetPreset;
  joinByAt: string;
  drawMode: "at_join_by" | "organiser_chooses";
  /** Null when the organiser draws names themselves. */
  drawAt: string | null;
  giftDay: string;
};

export type JoinAudience =
  | { kind: "guest"; joinedCount: number }
  | {
      kind: "signed-in";
      people: ReadonlyArray<JoinPerson>;
      note: string | null;
      viewerName: string;
      viewerEmail: string | null;
    };

export function JoinContent({ facts, audience, timeZone }: { facts: JoinFacts; audience: JoinAudience; timeZone: string }) {
  const organiser = firstName(facts.organiserName);
  const budget = budgetLabel(facts.budget);
  const drawAt = facts.drawMode === "organiser_chooses" ? null : facts.drawAt;
  const giftDay = formatYmdDay(facts.giftDay) ?? facts.giftDay;
  const schedule = {
    joinByAt: facts.joinByAt,
    drawMode: facts.drawMode,
    drawAt: facts.drawAt,
    giftDay: facts.giftDay,
    // WHY false: lastJoinDay reads the join-by and draw mode only.
    approvalRequired: false,
  };
  const onlyOrganiser =
    audience.kind === "signed-in" && audience.people.length === 1 && audience.people[0]?.isOrganiser === true;

  return (
    <>
      <div className="flex items-center gap-12">
        <Avatar name={facts.organiserName} size="nav" decorative />
        <p className="min-w-0 break-words text-body-base-semibold">{INVITE_COPY.invitedYou(facts.organiserName)}</p>
      </div>

      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-12">
          <ExchangeTag name={facts.exchangeName} tint={facts.tint} size="header" />
          <h1 className="break-words text-heading-1">{facts.exchangeName}</h1>
        </div>
        {audience.kind === "guest" ? (
          <p className="text-body-sm-regular text-text-secondary">{joinedCountLine(audience.joinedCount)}</p>
        ) : (
          <div className="flex flex-col gap-8">
            <AvatarStack
              people={audience.people.map((p, i) => ({ id: String(i), name: p.name }))}
              label={JOIN_COPY.stackLabel(audience.people)}
            />
            <p className="break-words text-body-sm-regular text-text-secondary">
              {onlyOrganiser ? JOIN_COPY.onlyOrganiser(organiser) : JOIN_COPY.inLine(audience.people)}
            </p>
          </div>
        )}
      </div>

      <DetailRows
        zoneLine={INVITE_COPY.zoneLine(zoneShortName(new Date(facts.joinByAt), timeZone))}
        rows={[
          { label: INVITE_COPY.budget, value: budget },
          {
            label: INVITE_COPY.joinBy,
            value:
              drawAt === null ? (
                EXCHANGE_COPY.flow.rules.endOfDay(lastJoinDay(schedule, timeZone))
              ) : (
                <LocalDateTime value={facts.joinByAt} timeZone={timeZone} format="dayTime" />
              ),
          },
          {
            label: INVITE_COPY.namesDrawn,
            value:
              drawAt === null ? (
                JOIN_COPY.drawWhenReady(organiser)
              ) : (
                <LocalDateTime value={drawAt} timeZone={timeZone} format="dayTime" />
              ),
          },
          { label: INVITE_COPY.giftsExchanged, value: giftDay },
        ]}
      />

      {audience.kind === "signed-in" && audience.note ? (
        <section aria-labelledby="note-heading" className="flex flex-col gap-8 rounded-2xl bg-surface-subtle p-16">
          <h2 id="note-heading" className="text-body-base-semibold">
            {JOIN_COPY.from(organiser)}
          </h2>
          <p className="whitespace-pre-wrap break-words text-body-base-regular text-text-secondary">{audience.note}</p>
        </section>
      ) : null}

      <section aria-labelledby="how-heading" className="flex flex-col gap-8">
        <h2 id="how-heading" className="text-body-base-semibold">
          {INVITE_COPY.how.title}
        </h2>
        <ol className="flex list-decimal flex-col gap-6 pl-20 text-body-sm-regular text-text-secondary">
          <li>{INVITE_COPY.how.wishlist}</li>
          <li>
            {drawAt === null
              ? INVITE_COPY.how.drawnManual(organiser)
              : INVITE_COPY.how.drawn(formatDay(new Date(drawAt), timeZone))}
          </li>
          <li>{INVITE_COPY.how.buy(budget, giftDay)}</li>
        </ol>
        <div className="flex flex-col gap-4 pt-8">
          <Alert variant="privacy">{INVITE_COPY.privacy(organiser)}</Alert>
          <p className="break-words pl-24 text-body-sm-regular text-text-muted">{INVITE_COPY.emailLine(organiser)}</p>
        </div>
      </section>

      {audience.kind === "signed-in" ? (
        <div className="flex items-center gap-12">
          <Avatar name={audience.viewerName} size="nav" decorative />
          <p className="min-w-0 break-words text-body-sm-regular text-text-secondary">
            {JOIN_COPY.joiningAs}{" "}
            <span className="font-semibold text-text-default">
              {audience.viewerEmail ? `${audience.viewerName}, ${audience.viewerEmail}` : audience.viewerName}
            </span>
          </p>
        </div>
      ) : null}
    </>
  );
}
