import { CaretRight, Envelope, Gift } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import type { ActionCardPlacement } from "@/components/ui/ActionCard";
import { Icon } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { cardKey } from "@/features/draw/card-dismiss";
import { CardReset } from "@/features/draw/components/CardDismiss";
import { DismissibleActionCard } from "@/features/draw/components/DismissibleActionCard";
import { DRAW_COPY } from "@/features/draw/copy";
import { RecipientNameProvider } from "@/features/draw/components/RecipientName";
import { RecipientRow } from "@/features/draw/components/RecipientRow";
import type { DrawSummary, MyAssignment } from "@/features/draw/types";
import { drawnListSubline } from "@/features/exchange-list/copy";
import type { ExclusionsEntry } from "@/features/exclusions/types";
import { DetailRows } from "@/features/joining/components/DetailRows";
import { RevealedCard } from "@/features/gifting/components/RevealedCard";
import { firstName } from "@/features/joining/copy";
import { formatDayTime, formatYmdDay, zoneShortName } from "@/lib/dates/format";
import { budgetLabel } from "@/lib/money/budget";
import { EXCHANGE_COPY } from "../copy";
import { peopleIn } from "../people";
import type { MemberExchange, OrganiserExchange, OwnListSummary } from "../types";
import { ExchangeDetailHeader } from "./ExchangeDetailHeader";
import { OrganiserTools } from "./OrganiserTools";
import { PeopleSection } from "./PeopleSection";

type Props = { assignment: MyAssignment | null; timeZone: string } & (
  | { role: "organiser"; exchange: OrganiserExchange; summary: DrawSummary | null; exclusions: ExclusionsEntry | null }
  | { role: "member"; exchange: MemberExchange }
);

// S14 Exchange detail after the draw (GC-013, GCO-012; boards Exchange-Detail-odrawn, -drawn, -revealed, -hidden,
// Org-Drawn-justexchange). One view for the three people it serves: a participant, an organiser who takes part, and an
// organiser who only organises. WHY one: the sections are the same and must not drift (Dates, People, the note).
// WHY the organiser's view has a "Names drawn" section and no pair of any kind: it knows a count and a time, and the
// props have no field for more (pair secrecy). WHY Organiser tools shows only Exclusions (owner Q8): Edit details, Hand
// over and Cancel arrive with slices 13, 14 and 15. WHY no "Leave exchange…": slice 14. The ActionCard is the reveal
// prompt until the giver has revealed once, then the "You're buying for {first}." card (slice 11, GC-015; not dismissible, owner B1).
// WHY the person's name is read by RecipientNameProvider and not here: it must never be in the server-rendered page.
export function ExchangeDrawn(props: Props) {
  const { assignment, timeZone } = props;
  const copy = EXCHANGE_COPY.detail;
  const e = props.exchange;
  const organiser = props.role === "organiser";
  const takingPart = organiser ? props.exchange.takingPart : true;
  const gift = formatYmdDay(e.giftDay) ?? "";
  const list: OwnListSummary | null = e.myList;
  const summary = organiser ? props.summary : null;

  const second = organiser
    ? `${takingPart ? DRAW_COPY.organiserTakingPart : DRAW_COPY.justOrganisingLine} · ${copy.spends(budgetLabel(e.budget))}`
    : `${copy.organisedBy(props.exchange.organiserName)} · ${copy.spends(budgetLabel(e.budget))}`;
  const people = organiser ? (takingPart ? props.exchange.people : props.exchange.people.filter((p) => !p.isMe)) : props.exchange.people;
  const count = organiser ? peopleIn(takingPart, props.exchange.peopleCount) : props.exchange.people.length;

  const dateRows = [
    { label: copy.joinByLabel, value: formatDayTime(new Date(e.joinByAt), timeZone) },
    // WHY organiser only: the draw moment is read from the organiser's own summary, and no function gives it to a member.
    ...(summary ? [{ label: copy.namesDrawnLabel, value: formatDayTime(new Date(summary.drawnAt), timeZone) }] : []),
    { label: copy.giftsLabel, value: gift },
  ];

  // WHY two placements: a banner first and a tray last, so the focus order matches what is on screen at each size (WCAG 2.4.3).
  // WHY the assignment id: a replaced assignment is a new card (GC-014). The id is the caller's own, already on this page.
  const key = assignment ? cardKey("reveal", assignment.assignmentId) : null;
  const card = (placement: ActionCardPlacement) =>
    assignment && assignment.revealed ? (
      <RevealedCard exchangeId={e.id} assignmentId={assignment.assignmentId} placement={placement} spend={budgetLabel(e.budget)} giftDay={gift} />
    ) : assignment && key ? (
      <DismissibleActionCard
        cardKey={key}
        label={DRAW_COPY.needsYou}
        placement={placement}
        icon={Gift}
        title={DRAW_COPY.cardTitle(e.name)}
        sub={DRAW_COPY.cardSub}
        action={
          <Button variant="brand" icon={Envelope} href={`/exchanges/${e.id}/reveal`} fullWidth className="md:w-auto">
            {DRAW_COPY.reveal}
          </Button>
        }
      />
    ) : null;

  const page = (
    <div className="flex flex-col gap-32">
      {/* WHY the banner sits outside the reading column: boards S14 make it the width of the content area (1040 at 1440), while the page below it reads in a 640 column. */}
      {card("banner")}
      {/* WHY: once revealed the card's condition is gone, so an old Dismiss must not hide a later one. */}
      {assignment && key && assignment.revealed ? <CardReset cardKey={key} /> : null}
      <div className="flex flex-col gap-32 md:max-w-reading-max">
        <ExchangeDetailHeader name={e.name} tint={e.tint}>
          <p className="text-body-base-regular text-text-default">{DRAW_COPY.headerDrawn(gift)}</p>
          <p className="text-body-sm-regular text-text-muted">{second}</p>
        </ExchangeDetailHeader>

        {summary ? (
          <section aria-labelledby="drawn-heading" className="flex flex-col gap-8">
            <h2 id="drawn-heading" className="text-heading-4">
              {DRAW_COPY.drawnSection}
            </h2>
            <p className="text-body-base-regular text-text-secondary">{DRAW_COPY.drawnSentence(summary.told, summary.peopleCount)}</p>
          </section>
        ) : null}

        <section aria-labelledby="part-heading" className="flex flex-col gap-4">
          <h2 id="part-heading" className="text-heading-4">
            {copy.yourPart}
          </h2>
          {takingPart && list ? (
            <ul>
              {/* GC-010: after the draw the row opens the list page, where a list is attached when nothing is, or removed. */}
              <ListRow
                title={copy.yourListTitle}
                sub={drawnListSubline(list)}
                href={`/exchanges/${e.id}/${organiser ? "my-list" : "list"}`}
                meta={<Icon icon={CaretRight} className="text-text-muted" />}
              />
              {assignment ? (
                <RecipientRow exchangeId={e.id} assignmentId={assignment.assignmentId} revealedBefore={assignment.revealed} />
              ) : null}
            </ul>
          ) : (
            <p className="text-body-base-regular text-text-secondary">{DRAW_COPY.justOrganisingBody}</p>
          )}
        </section>

        <section aria-labelledby="dates-heading" className="flex flex-col gap-4">
          <h2 id="dates-heading" className="text-heading-4">
            {copy.datesTitle}
          </h2>
          <DetailRows rows={dateRows} zoneLine={copy.zoneLine(zoneShortName(new Date(e.joinByAt), timeZone))} />
        </section>

        <PeopleSection people={people} alone={false} count={count} />

        {e.note ? (
          <section aria-labelledby="note-heading" className="flex flex-col gap-8 rounded-2xl bg-surface-subtle p-16">
            <h2 id="note-heading" className="text-body-base-semibold">
              {organiser ? DRAW_COPY.yourNote : copy.fromOrganiser(firstName(props.exchange.organiserName))}
            </h2>
            <p className="whitespace-pre-line break-words text-body-base-regular text-text-secondary">{e.note}</p>
          </section>
        ) : null}

        {organiser && props.exclusions ? (
          <OrganiserTools
            exchangeId={e.id}
            exchangeName={e.name}
            lastJoinDay=""
            inviteUrl={null}
            approvalRequired={props.exchange.approvalRequired}
            waitingNames={[]}
            exclusions={props.exclusions}
            draw={null}
          />
        ) : null}

        {card("tray")}
      </div>
    </div>
  );

  // WHY the provider wraps the whole page: the row and both placements of the card share one read of the name.
  return assignment ? (
    <RecipientNameProvider exchangeId={e.id} assignmentId={assignment.assignmentId} revealedBefore={assignment.revealed}>
      {page}
    </RecipientNameProvider>
  ) : (
    page
  );
}
