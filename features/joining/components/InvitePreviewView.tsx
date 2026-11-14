import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { LocalDateTime } from "@/components/ui/LocalDateTime";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { lastJoinDay } from "@/features/exchanges/timeline";
import { formatDay, formatYmdDay, zoneShortName } from "@/lib/dates/format";
import { budgetLabel } from "@/lib/money/budget";
import { INVITE_COPY, JOIN_COPY, firstName, joinedCountLine } from "../copy";
import type { InvitePreview } from "../types";
import { DetailRows } from "./DetailRows";
import { InviteActions } from "./InviteActions";
import { InviteFrame } from "./InviteFrame";

// S02 Invite preview (GC-002). Boards: Entry-Invite-default, -alone (m, d), -offline. Public: it shows the
// inviter, the exchange and a count, never a face or name of anyone else (GC-002 context C).
//
// WHY the date rows follow JoinContent: get_invite_preview returns draw_mode and draw_at (owner decision
// 2026-11-14), so an organiser-draws exchange reads "when {first name} is ready" here as on the join page.
export function InvitePreviewView({
  preview,
  token,
  signedIn,
  timeZone,
}: {
  preview: InvitePreview;
  token: string;
  signedIn: boolean;
  timeZone: string;
}) {
  const joinBy = new Date(preview.joinByAt);
  const manual = preview.drawMode === "organiser_chooses" || preview.drawAt === null;
  const schedule = {
    joinByAt: preview.joinByAt,
    drawMode: preview.drawMode,
    drawAt: preview.drawAt,
    giftDay: preview.giftDay,
    // WHY false: lastJoinDay reads the join-by and draw mode only.
    approvalRequired: false,
  };
  return (
    <InviteFrame footer={<InviteActions token={token} signedIn={signedIn} />}>
      <div className="flex items-center gap-12">
        <Avatar name={preview.inviterName} size="nav" decorative />
        <p className="min-w-0 break-words text-body-base-semibold">{INVITE_COPY.invitedYou(preview.inviterName)}</p>
      </div>
      <div className="flex flex-col gap-12">
        <ExchangeTag name={preview.exchangeName} tint={preview.tint} size="header" />
        <h1 className="break-words text-heading-1">{preview.exchangeName}</h1>
        <p className="text-body-sm-regular text-text-secondary">{joinedCountLine(preview.joinedCount)}</p>
      </div>
      <DetailRows
        zoneLine={INVITE_COPY.zoneLine(zoneShortName(joinBy, timeZone))}
        rows={[
          { label: INVITE_COPY.budget, value: budgetLabel(preview.budget) },
          {
            label: INVITE_COPY.joinBy,
            value: manual ? (
              EXCHANGE_COPY.flow.rules.endOfDay(lastJoinDay(schedule, timeZone))
            ) : (
              <LocalDateTime value={preview.joinByAt} timeZone={timeZone} format="dayTime" />
            ),
          },
          {
            label: INVITE_COPY.namesDrawn,
            value:
              manual || preview.drawAt === null ? (
                JOIN_COPY.drawWhenReady(firstName(preview.inviterName))
              ) : (
                <LocalDateTime value={preview.drawAt} timeZone={timeZone} format="dayTime" />
              ),
          },
          { label: INVITE_COPY.giftDay, value: formatYmdDay(preview.giftDay) ?? preview.giftDay },
        ]}
      />
      <section aria-labelledby="how-heading" className="flex flex-col gap-8">
        <h2 id="how-heading" className="text-body-base-semibold">
          {INVITE_COPY.how.title}
        </h2>
        <ol className="flex list-decimal flex-col gap-6 pl-20 text-body-sm-regular text-text-secondary">
          <li>{INVITE_COPY.how.join}</li>
          <li>{INVITE_COPY.how.drawn(formatDay(joinBy, timeZone))}</li>
          <li>{INVITE_COPY.how.reveal}</li>
        </ol>
      </section>
      <Alert variant="privacy">{INVITE_COPY.privacy(firstName(preview.inviterName))}</Alert>
    </InviteFrame>
  );
}
