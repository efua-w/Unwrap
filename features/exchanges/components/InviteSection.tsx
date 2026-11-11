import { ShareActions } from "@/components/ui/ShareActions";
import { EXCHANGE_COPY } from "../copy";

const LINK_ID = "exchange-invite-link";

type Props = {
  exchangeName: string;
  /** The last day people can join, as the viewer sees it. */
  lastJoinDay: string;
  /** The full invite link, built on the server. Passed to the organiser's section only (GCO-004). */
  inviteUrl: string;
};

// GCO-004 / S14 "Share the invite link". Invite by email (GCO-005) is hidden until slice 7 builds it.
// WHY id="invite": Exchanges' "Share invite link" lands here.
export function InviteSection({ exchangeName, lastJoinDay, inviteUrl }: Props) {
  const copy = EXCHANGE_COPY.detail;
  const message = copy.whatsAppMessage(exchangeName, inviteUrl);
  return (
    <section id="invite" aria-labelledby="invite-heading" className="flex scroll-mt-24 flex-col gap-16">
      <div className="flex flex-col gap-4">
        <h2 id="invite-heading" className="text-heading-4">
          {copy.inviteTitle}
        </h2>
        <p className="text-body-sm-regular text-text-secondary">{copy.inviteBody(lastJoinDay)}</p>
      </div>
      <div className="flex flex-col gap-4 rounded-xl bg-surface-subtle px-16 py-12">
        <span className="text-body-sm-regular text-text-muted">{copy.inviteLinkLabel}</span>
        <span id={LINK_ID} className="break-all text-body-base-semibold">
          {inviteUrl}
        </span>
      </div>
      <div className="flex flex-col gap-12">
        <ShareActions url={inviteUrl} whatsAppHref={`https://wa.me/?text=${encodeURIComponent(message)}`} linkElementId={LINK_ID} />
      </div>
    </section>
  );
}
