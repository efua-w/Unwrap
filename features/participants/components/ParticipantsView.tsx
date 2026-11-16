"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { InvitePeopleSheet } from "@/features/exchanges/components/InvitePeopleSheet";
import { firstName } from "@/features/joining/copy";
import { approveJoinRequest, declineJoinRequest, removeMember, type DecideResult } from "../actions";
import { PARTICIPANTS_COPY } from "../copy";
import type { JoinRequestLine, ParticipantLine } from "../types";

type Props = {
  exchangeId: string;
  exchangeName: string;
  requests: readonly JoinRequestLine[];
  people: readonly ParticipantLine[];
  /** Nobody but the viewer is taking part: the alone card replaces the list. */
  alone: boolean;
  /** The last day people can join, as the viewer sees it. */
  lastJoinDay: string;
  /** Null once joining has closed: there is no link left to share. Organiser-only (GCO-004). */
  inviteUrl: string | null;
  approvalRequired: boolean;
  /** False once the exchange is past joining (drawn, ended): Approve and Remove are always refused then. Decline stays. */
  canManage: boolean;
};

type Pending = { id: string; kind: "approve" | "decline" };

// S30 Participants and S31 Remove person (GCO-007, GC-012; boards Org-People-*, Org-Remove-*). The page
// that renders this has already refused everyone but the organiser, and the props carry names, the member
// and request ids, and times only: no email, user id or list status (AC-12, AC-17, AC-41).
// WHY the page re-reads after every change instead of editing local state: the database decides who is in,
// so the list shown is always the one it returns.
export function ParticipantsView({ exchangeId, exchangeName, requests, people, alone, lastJoinDay, inviteUrl, approvalRequired, canManage }: Props) {
  const copy = PARTICIPANTS_COPY;
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const [pending, setPending] = useState<Pending | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // WHY the person outlives the sheet: its closing animation still shows their name.
  const [removing, setRemoving] = useState<ParticipantLine | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeFailure, setRemoveFailure] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const busy = pending !== null || removeBusy;

  // WHY: when a row goes away the control that had focus goes with it, and focus would fall to the page
  // top. Hand it to the page heading instead, once, and only when nothing else holds it.
  const rows = requests.length + people.length;
  const previousRows = useRef(rows);
  useEffect(() => {
    if (rows < previousRows.current && (!document.activeElement || document.activeElement === document.body)) {
      document.getElementById("participants-heading")?.focus();
    }
    previousRows.current = rows;
  }, [rows]);

  function lineFor(result: Exclude<DecideResult, { ok: true }>): string {
    switch (result.reason) {
      case "stale":
        return copy.stale;
      case "full":
        return copy.full(exchangeName);
      case "ended":
        return copy.ended;
      default:
        return copy.failed;
    }
  }

  async function decide(request: JoinRequestLine, kind: Pending["kind"]) {
    if (busy || !online) return;
    setFailure(null);
    setPending({ id: request.requestId, kind });
    try {
      const result = await (kind === "approve" ? approveJoinRequest : declineJoinRequest)(request.requestId);
      setPending(null);
      if (result.ok) {
        // WHY nothing for Decline: the board has no toast for it, and the row going away is the answer.
        if (kind === "approve") toast.show({ message: copy.approvedToast(firstName(request.name)) });
        router.refresh();
        return;
      }
      if (result.reason === "signed-out") return router.replace(`/login?next=${encodeURIComponent(`/exchanges/${exchangeId}/participants`)}`);
      setFailure(lineFor(result));
      // A refusal means the list was stale: read it again so the screen matches the database.
      if (result.reason !== "failed") router.refresh();
    } catch {
      setPending(null);
      reportNetworkError();
    }
  }

  async function confirmRemove() {
    if (!removing || busy || !online) return;
    const person = removing;
    setRemoveFailure(null);
    setRemoveBusy(true);
    try {
      const result = await removeMember(person.memberId);
      setRemoveBusy(false);
      if (result.ok) {
        setRemoveOpen(false);
        toast.show({ message: copy.removedToast(firstName(person.name), exchangeName) });
        router.refresh();
        return;
      }
      if (result.reason === "signed-out") return router.replace(`/login?next=${encodeURIComponent(`/exchanges/${exchangeId}/participants`)}`);
      setRemoveFailure(lineFor(result));
      if (result.reason !== "failed") router.refresh();
    } catch {
      setRemoveBusy(false);
      reportNetworkError();
    }
  }

  return (
    <div className="flex flex-col gap-32">
      {failure ? <Alert variant="error">{failure}</Alert> : null}

      {requests.length > 0 ? (
        <section aria-labelledby="wants-heading" className="flex flex-col gap-4">
          <h2 id="wants-heading" className="text-heading-4">
            {copy.wantsTitle(requests.length)}
          </h2>
          <ul>
            {requests.map((request, index) => {
              const mine = pending?.id === request.requestId ? pending.kind : null;
              return (
                <li
                  key={request.requestId}
                  className={cx(
                    "flex flex-col gap-12 py-12 md:flex-row md:items-center md:gap-16",
                    index > 0 && "border-t-1 border-border-default",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-12">
                    <Avatar name={request.name} decorative />
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="break-words text-body-base-semibold text-text-default">{request.name}</span>
                      <span className="text-body-sm-regular text-text-muted">{request.askedLabel}</span>
                    </span>
                  </div>
                  {/* Sibling targets: two buttons side by side, never one inside another. */}
                  <div className="flex gap-8 *:flex-1 md:*:flex-none">
                    {/* WHY: after the event the database refuses Approve (GCO-007), so it is not offered. */}
                    {canManage ? (
                      <Button variant="primary" busy={mine === "approve"} disabled={!online || (busy && mine !== "approve")} onClick={() => decide(request, "approve")}>
                        {copy.approve}
                        <span className="sr-only"> {request.name}</span>
                      </Button>
                    ) : null}
                    <Button variant="secondary" busy={mine === "decline"} disabled={!online || (busy && mine !== "decline")} onClick={() => decide(request, "decline")}>
                      {copy.decline}
                      <span className="sr-only"> {request.name}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {alone ? (
        <EmptyState
          title={copy.aloneTitle}
          body={inviteUrl ? copy.aloneBody(lastJoinDay) : copy.aloneBodyClosed}
          action={
            inviteUrl ? (
              <Button aria-haspopup="dialog" onClick={() => setInviteOpen(true)}>
                {copy.aloneAction}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <section aria-labelledby="taking-heading" className="flex flex-col gap-4">
          <h2 id="taking-heading" className="text-heading-4">
            {copy.takingTitle(people.length)}
          </h2>
          <ul>
            {people.map((person, index) => (
              <ListRow
                key={person.memberId}
                title={person.isMe ? `${person.name} ${copy.you}` : person.name}
                leading={<Avatar name={person.name} decorative />}
                divider={index > 0}
                action={
                  // WHY no Remove on the organiser's own row: the database refuses it too (22023 organiser); nor once past joining.
                  person.isOrganiser || !canManage ? undefined : (
                    <Button
                      variant="link"
                      aria-haspopup="dialog"
                      disabled={!online || busy}
                      onClick={() => {
                        setRemoveFailure(null);
                        setRemoving(person);
                        setRemoveOpen(true);
                      }}
                    >
                      {copy.remove}
                      <span className="sr-only"> {person.name}</span>
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        </section>
      )}

      <Alert variant="privacy">{copy.privacy}</Alert>

      {inviteUrl && !alone ? (
        <div>
          <Button variant="secondary" fullWidth className="md:w-auto" aria-haspopup="dialog" onClick={() => setInviteOpen(true)}>
            {copy.inviteMore}
          </Button>
        </div>
      ) : null}

      {inviteUrl ? (
        <InvitePeopleSheet
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          exchangeId={exchangeId}
          exchangeName={exchangeName}
          lastJoinDay={lastJoinDay}
          inviteUrl={inviteUrl}
          approvalRequired={approvalRequired}
          waitingNames={requests.map((r) => r.name)}
        />
      ) : null}

      <Sheet
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        variant="destructive"
        title={removing ? copy.removeTitle(firstName(removing.name), exchangeName) : ""}
        description={removing ? copy.removeBody(firstName(removing.name)) : undefined}
        busy={removeBusy}
        footer={
          <>
            {online ? null : <p className="text-body-sm-regular text-text-secondary">{copy.removeOffline}</p>}
            <Button variant="destructive" fullWidth busy={removeBusy} disabled={!online} onClick={confirmRemove}>
              {removing ? copy.removeConfirm(firstName(removing.name)) : ""}
            </Button>
            <Button variant="text" fullWidth disabled={removeBusy} onClick={() => setRemoveOpen(false)}>
              {copy.removeKeep}
            </Button>
          </>
        }
      >
        {removeFailure ? <Alert variant="error">{removeFailure}</Alert> : null}
      </Sheet>
    </div>
  );
}
