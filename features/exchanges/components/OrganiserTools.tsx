"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";
import { ShareActions } from "@/components/ui/ShareActions";
import { useToast } from "@/components/ui/Toast";
import { resetInviteLink } from "../actions";
import { EXCHANGE_COPY } from "../copy";

const LINK_ID = "invite-sheet-link";

type Props = {
  exchangeId: string;
  exchangeName: string;
  /** The last day people can join, as the viewer sees it. */
  lastJoinDay: string;
  /** Built on the server. Organiser-only (GCO-004, GCO-005). */
  inviteUrl: string;
};

type Step = "closed" | "invite" | "reset";

// GCO-005 Invite people (boards Exchange-Detail-oattached, Org-Invite-default/-reset/-resetdone/-offline).
// Only the tool whose feature exists is shown: Edit, Draw, Exclusions, Hand over and Cancel arrive with
// slices 9, 10, 13, 14 and 15. WHY the reset result replaces the link on screen: the old link no longer
// works, so showing it again would hand out a dead link.
export function OrganiserTools({ exchangeId, exchangeName, lastJoinDay, inviteUrl }: Props) {
  const copy = EXCHANGE_COPY.detail;
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const [step, setStep] = useState<Step>("closed");
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const url = freshUrl ?? inviteUrl;

  async function reset() {
    if (busy || !online) return;
    setFailure(null);
    setBusy(true);
    try {
      const result = await resetInviteLink(exchangeId);
      setBusy(false);
      if (result.ok) {
        setFreshUrl(result.inviteUrl);
        setStep("invite");
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
    <section aria-labelledby="tools-heading" className="flex flex-col gap-4">
      <h2 id="tools-heading" className="text-heading-4">
        {copy.toolsTitle}
      </h2>
      <ul>
        <ListRow title={copy.toolInvite} sub={copy.toolInviteSub(lastJoinDay)} onClick={() => setStep("invite")} />
      </ul>

      <Sheet
        open={step === "invite"}
        onClose={() => setStep("closed")}
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
            <Button variant="text" fullWidth onClick={() => setStep("closed")}>
              {copy.done}
            </Button>
            <Button
              variant="destructive-text"
              fullWidth
              aria-haspopup="dialog"
              onClick={() => {
                setFailure(null);
                setStep("reset");
              }}
            >
              {copy.resetLink}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 rounded-xl bg-surface-subtle px-16 py-12">
          <span className="text-body-sm-regular text-text-muted">{copy.inviteLinkLabel}</span>
          <span id={LINK_ID} className="break-all text-body-base-semibold">
            {url}
          </span>
        </div>
      </Sheet>

      <Sheet
        open={step === "reset"}
        onClose={() => setStep("invite")}
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
            <Button variant="text" fullWidth disabled={busy} onClick={() => setStep("invite")}>
              {copy.resetKeep}
            </Button>
          </>
        }
      >
        {failure ? <Alert variant="error">{failure}</Alert> : null}
      </Sheet>
    </section>
  );
}
