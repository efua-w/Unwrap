"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { inviteJoinPath } from "@/lib/auth/invite-path";
import { joinExchange } from "../actions";
import { JOIN_COPY } from "../copy";
import { InviteFrame } from "./InviteFrame";

// S10 actions (GC-009). Boards: Joining-Confirm-busy, -error, -offline. The token is the only input to
// the action. Join exchange goes to the attach page (S11, GC-010); a refusal (closed, cancelled, full,
// removed, approval, or a link that no longer works) re-reads this page, whose server code shows the
// matching Invite unavailable state (S13), so the decision always comes from the database's answer.
// A failed attempt keeps everything on screen and offers Try again.
export function JoinForm({ token, exchangeName, children }: { token: string; exchangeName: string; children: ReactNode }) {
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function join() {
    if (busy || !online) return;
    setBusy(true);
    setFailed(false);
    try {
      const result = await joinExchange(token);
      if (result.ok) {
        // WHY busy stays on: the page is leaving, and a second tap must not join twice.
        router.push(`/exchanges/${result.exchangeId}/list?from=join`);
        return;
      }
      if (result.reason === "signed-out") {
        router.push(`/login?next=${encodeURIComponent(inviteJoinPath(token))}`);
        return;
      }
      if (result.reason === "failed") setFailed(true);
      else router.refresh();
    } catch {
      reportNetworkError();
    }
    setBusy(false);
  }

  return (
    <InviteFrame
      footer={
        <>
          <Button fullWidth busy={busy} disabled={!online} onClick={join}>
            {JOIN_COPY.join}
          </Button>
          <Button variant="text" fullWidth href="/home" disabled={busy || !online}>
            {JOIN_COPY.notNow}
          </Button>
        </>
      }
    >
      {children}
      {failed ? (
        <Alert
          variant="error"
          action={
            <Button variant="link" onClick={join}>
              {JOIN_COPY.tryAgain}
            </Button>
          }
        >
          {JOIN_COPY.failed(`'${exchangeName}'`)}
        </Alert>
      ) : null}
    </InviteFrame>
  );
}
