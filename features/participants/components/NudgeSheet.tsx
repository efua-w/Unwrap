"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { firstName } from "@/features/joining/copy";
import { sendNudge, undoNudge } from "../actions";
import { NUDGE_COPY } from "../copy";
import { waitingNames } from "../format";
import type { NudgeTarget } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  exchangeId: string;
  exchangeName: string;
  /** The organiser's own first name, as the email will name them. */
  organiserFirst: string;
  /** "Fri 27 Nov" for an automatic draw, in the viewer's zone. Null when the organiser draws names themselves. */
  drawDay: string | null;
  /** The people a nudge would reach now: no list yet and not nudged in the last 12 hours. Empty means "everyone was nudged recently". */
  targets: readonly NudgeTarget[];
};

// GCO-008 Nudge (S32; boards Org-Nudge-default, -busy, -sent, -recent, -offline). Shared by the exchange page's
// readiness block and Participants. WHY the server decides again: the list here was true when the page loaded, and
// send_nudge skips anyone who has added a list or was nudged since, and names only the people it queued (owner
// decision 2026-11-18 2), so the toast is what happened and not what was asked.
export function NudgeSheet({ open, onClose, exchangeId, exchangeName, organiserFirst, drawDay, targets }: Props) {
  const copy = NUDGE_COPY;
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // WHY set after a send that queued nobody: every person was nudged by someone else a moment ago.
  const [allSkipped, setAllSkipped] = useState(false);
  const recent = targets.length === 0 || allSkipped;
  const [only] = targets;
  const first = only ? firstName(only.name) : "";

  function close() {
    setFailure(null);
    setAllSkipped(false);
    onClose();
  }

  async function undo() {
    try {
      const result = await undoNudge(exchangeId);
      if (!result.ok) {
        if (result.reason === "signed-out") return router.replace(`/login?next=${encodeURIComponent(`/exchanges/${exchangeId}`)}`);
        return toast.show({ message: copy.failed });
      }
      toast.show({ message: result.stopped > 0 ? copy.undoneToast : copy.undoTooLate });
      router.refresh();
    } catch {
      reportNetworkError();
    }
  }

  async function send() {
    if (busy || !online || recent) return;
    setFailure(null);
    setBusy(true);
    try {
      const result = await sendNudge(
        exchangeId,
        targets.map((t) => t.memberId),
      );
      setBusy(false);
      if (result.ok) {
        if (result.names.length === 0) {
          setAllSkipped(true);
          router.refresh();
          return;
        }
        close();
        toast.show({ message: copy.sentToast(waitingNames(result.names)), action: { label: copy.undo, onAction: undo } });
        router.refresh();
        return;
      }
      if (result.reason === "signed-out") return router.replace(`/login?next=${encodeURIComponent(`/exchanges/${exchangeId}`)}`);
      setFailure(result.reason === "rate-limited" ? copy.rateLimited : copy.failed);
      // WHY: the exchange moved on (cancelled, or past the point nudges make sense), so show it as it is now.
      if (result.reason === "ended") router.refresh();
    } catch {
      setBusy(false);
      reportNetworkError();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      variant="confirm"
      busy={busy}
      title={recent ? copy.recentTitle : copy.title(targets.length, first)}
      description={recent ? copy.recentBody : waitingNames(targets.map((t) => t.name))}
      footer={
        <>
          <Button fullWidth busy={busy} disabled={!online || recent} onClick={send}>
            {copy.send}
          </Button>
          <Button variant="text" fullWidth disabled={busy} onClick={close}>
            {recent ? copy.close : copy.cancel}
          </Button>
        </>
      }
    >
      {recent ? null : (
        <>
          <p className="text-body-base-regular text-text-secondary">{online ? copy.body : copy.bodyOffline}</p>
          <blockquote className="rounded-xl bg-surface-subtle px-16 py-12 text-body-base-regular text-text-default">
            {copy.preview(organiserFirst, exchangeName, drawDay)}
          </blockquote>
          <p className="text-body-sm-regular text-text-muted">{copy.privacy}</p>
        </>
      )}
      {failure ? <Alert variant="error">{failure}</Alert> : null}
    </Sheet>
  );
}
