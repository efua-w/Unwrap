"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { inviteJoinPath } from "@/lib/auth/invite-path";
import { joinExchange } from "../actions";
import { INVITE_COPY, JOIN_COPY } from "../copy";
import { InviteFrame } from "./InviteFrame";

// S10 actions (GC-009). Boards: Join-Exchange-busy, -error, -offline. The token is the only input to
// the action. Join exchange goes to the attach page (S11, GC-010); a refusal (closed, cancelled, full,
// removed, approval, or a link that no longer works) re-reads this page, whose server code shows the
// matching Invite unavailable state (S13), so the decision always comes from the database's answer.
// A failed attempt keeps everything on screen and offers Try again.
// `autoStart` (join-one-screen, owner decision 2): the post-sign-in action page joins the person once, as if
// they had tapped the button. The ref keeps React's development double effect from sending two calls.
export function JoinForm({
  token,
  exchangeName,
  autoStart = false,
  children,
}: {
  token: string;
  exchangeName: string;
  autoStart?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

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

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on arrival; join reads the latest state it needs
  }, [autoStart]);

  return (
    <InviteFrame
      footer={
        <>
          <Button fullWidth busy={busy} disabled={!online} onClick={join}>
            {INVITE_COPY.join}
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
