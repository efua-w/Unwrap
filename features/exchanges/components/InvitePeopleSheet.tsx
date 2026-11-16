"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ShareActions } from "@/components/ui/ShareActions";
import { useToast } from "@/components/ui/Toast";
import { firstName } from "@/features/joining/copy";
import { INVITE_APPROVAL_COPY } from "@/features/participants/copy";
import { resetInviteLink } from "../actions";
import { EXCHANGE_COPY } from "../copy";

const LINK_ID = "invite-sheet-link";

type Props = {
  open: boolean;
  onClose: () => void;
  exchangeId: string;
  exchangeName: string;
  /** The last day people can join, as the viewer sees it. */
  lastJoinDay: string;
  /** Built on the server. Organiser-only (GCO-004, GCO-005). */
  inviteUrl: string;
  /** True when the organiser approves each person: adds the approval line (board Org-Invite-default). */
  approvalRequired: boolean;
  /** Names of people waiting for approval. The organiser may read them (GCO-007). */
  waitingNames: readonly string[];
};

// GCO-005 Invite people (boards Exchange-Detail-oattached, Org-Invite-default/-reset/-resetdone/-offline),
// shared by the exchange page's Organiser tools and Participants' "Invite more people". Only the tool whose
// feature exists is shown: Edit, Draw, Exclusions, Hand over and Cancel arrive with slices 9, 10, 13, 14 and
// 15. WHY the reset result replaces the link on screen: the old link no longer works, so showing it again
// would hand out a dead link.
export function InvitePeopleSheet({ open, onClose, exchangeId, exchangeName, lastJoinDay, inviteUrl, approvalRequired, waitingNames }: Props) {
  const copy = EXCHANGE_COPY.detail;
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const [resetting, setResetting] = useState(false);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const url = freshUrl ?? inviteUrl;
  const [waitingFirst] = waitingNames;

  async function reset() {
    if (busy || !online) return;
    setFailure(null);
    setBusy(true);
    try {
      const result = await resetInviteLink(exchangeId);
      setBusy(false);
      if (result.ok) {
        setFreshUrl(result.inviteUrl);
        setResetting(false);
        toast.show({ message: copy.resetToast });
        router.refresh();
        return;
      }
      if (result.reason === "signed-out") return router.replace(`/login?next=${encodeURIComponent(`/exchanges/${exchangeId}`)}`);
      setFailure(result.reason === "ended" ? copy.resetClosed : copy.resetFailed);
    } catch {
      setBusy(false);
      reportNetworkError();
    }
  }

  return (
    <>
      <Sheet
        open={open && !resetting}
        onClose={onClose}
        variant="confirm"
        title={copy.toolInvite}
        description={copy.inviteSheetBody(lastJoinDay)}
        footer={
          <>
            <ShareActions
              url={url}
              whatsAppHref={`https://wa.me/?text=${encodeURIComponent(copy.whatsAppMessage(exchangeName, url))}`}
              linkElementId={LINK_ID}
            />
            <Button variant="text" fullWidth onClick={onClose}>
              {copy.done}
            </Button>
            <Button
              variant="destructive-text"
              fullWidth
              aria-haspopup="dialog"
              onClick={() => {
                setFailure(null);
                setResetting(true);
              }}
            >
              {copy.resetLink}
            </Button>
          </>
        }
      >
        {approvalRequired ? (
          <div className="flex flex-col gap-4 text-body-base-regular text-text-secondary">
            <p>{INVITE_APPROVAL_COPY.approval}</p>
            {waitingNames.length > 0 ? (
              <p>
                {waitingFirst !== undefined && waitingNames.length === 1
                  ? INVITE_APPROVAL_COPY.waitingOne(firstName(waitingFirst))
                  : INVITE_APPROVAL_COPY.waitingMany(waitingNames.length)}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-4 rounded-xl bg-surface-subtle px-16 py-12">
          <span className="text-body-sm-regular text-text-muted">{copy.inviteLinkLabel}</span>
          <span id={LINK_ID} className="break-all text-body-base-semibold">
            {url}
          </span>
        </div>
      </Sheet>

      <Sheet
        open={open && resetting}
        onClose={() => setResetting(false)}
        variant="destructive"
        title={copy.resetTitle}
        description={copy.resetBody}
        busy={busy}
        footer={
          <>
            {online ? null : <p className="text-body-sm-regular text-text-secondary">{copy.resetOffline}</p>}
            <Button variant="destructive" fullWidth busy={busy} disabled={!online} onClick={reset}>
              {copy.resetConfirm}
            </Button>
            <Button variant="text" fullWidth disabled={busy} onClick={() => setResetting(false)}>
              {copy.resetKeep}
            </Button>
          </>
        }
      >
        {failure ? <Alert variant="error">{failure}</Alert> : null}
      </Sheet>
    </>
  );
}
