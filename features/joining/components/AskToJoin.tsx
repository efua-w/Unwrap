"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { inviteJoinPath } from "@/lib/auth/invite-path";
import { requestToJoin } from "../actions";
import { JOIN_COPY, REQUEST_COPY, UNAVAILABLE_COPY } from "../copy";
import { InviteFrame } from "./InviteFrame";

// Ask to join (GC-012, GCO-003). Boards: Join-Exchange-approval, Joining-Confirm-requested, Joining-Unavailable-closed /
// -asking / -error / -sent. Three ways in:
//   confirm  an approval exchange: the one invite screen with Ask to join (children = JoinContent)
//   closed   joining closed, a request is allowed: S13 plus Ask to join
//   removed  a removed person (owner decision Q5): S13-style, no names of anyone in the exchange
// The token is the only input to the action (plan §6 invariant 8). A refusal re-reads the page, whose
// server code shows the state the database now holds; a failed send keeps everything and offers Try again.
// On success the page shows the request-sent state (Q6: no email or Home promise, the button goes to
// Exchanges). A second tap while busy does nothing.
export function AskToJoin({
  token,
  variant,
  exchangeName,
  organiserFirstName,
  body,
  sentRows,
  autoStart = false,
  children,
}: {
  token: string;
  variant: "confirm" | "closed" | "removed";
  exchangeName: string;
  organiserFirstName: string;
  /** The S13 line for "closed" and "removed". */
  body?: string;
  /** Server-rendered rows for the sent state (the join-by date), confirm only. */
  sentRows?: ReactNode;
  /** Join-one-screen: send the request once on arrival (confirm only; see JoinForm). */
  autoStart?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);
  const started = useRef(false);

  async function ask() {
    if (busy || !online) return;
    setBusy(true);
    setFailed(false);
    try {
      const result = await requestToJoin(token);
      if (result.ok) {
        setSent(true);
      } else if (result.reason === "signed-out") {
        router.push(`/login?next=${encodeURIComponent(inviteJoinPath(token))}`);
        return;
      } else if (result.reason === "failed") {
        setFailed(true);
      } else {
        router.refresh();
      }
    } catch {
      reportNetworkError();
    }
    setBusy(false);
  }

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on arrival; ask reads the latest state it needs
  }, [autoStart]);

  if (sent) {
    return (
      <InviteFrame
        footer={
          <Button fullWidth href="/exchanges">
            {REQUEST_COPY.goToExchanges}
          </Button>
        }
      >
        {/* Boards Joining-Confirm-requested / -Unavailable-sent: the exchange sits in a quiet card, no tag. */}
        <div className="flex min-w-0 flex-col rounded-2xl bg-surface-subtle px-24 py-16">
          <p className="text-body-sm-regular text-text-secondary">{REQUEST_COPY.sent}</p>
          <p className="break-words text-body-base-semibold">{exchangeName}</p>
        </div>
        <div className="flex flex-col gap-8" role="status">
          <h1 className="break-words text-heading-1">{REQUEST_COPY.waitingFor(organiserFirstName)}</h1>
          <p className="break-words text-body-base-regular text-text-secondary">{REQUEST_COPY.sentBody(organiserFirstName)}</p>
        </div>
        {sentRows}
      </InviteFrame>
    );
  }

  const alert = failed ? (
    <Alert
      variant="error"
      action={
        <Button variant="link" onClick={ask}>
          {REQUEST_COPY.tryAgain}
        </Button>
      }
    >
      {REQUEST_COPY.failed}
    </Alert>
  ) : null;

  const askButton = (
    <Button fullWidth busy={busy} disabled={!online} onClick={ask}>
      {REQUEST_COPY.ask}
    </Button>
  );

  if (variant === "confirm") {
    return (
      <InviteFrame
        footer={
          <>
            {askButton}
            <Button variant="text" fullWidth href="/home" disabled={busy || !online}>
              {JOIN_COPY.notNow}
            </Button>
          </>
        }
      >
        {children}
        <p className="break-words text-body-sm-regular text-text-secondary">{REQUEST_COPY.approvalLine(organiserFirstName)}</p>
        {alert}
      </InviteFrame>
    );
  }

  return (
    <InviteFrame footer={askButton}>
      <div className="flex flex-col gap-8">
        <h1 className="text-heading-1">{UNAVAILABLE_COPY.title}</h1>
        <p className="break-words text-body-base-regular text-text-secondary">{body}</p>
        {variant === "closed" ? (
          <p className="break-words text-body-base-regular text-text-secondary">{REQUEST_COPY.stillAsk(organiserFirstName)}</p>
        ) : null}
      </div>
      {alert}
    </InviteFrame>
  );
}
