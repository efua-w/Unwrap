"use client";

import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { ListRow } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { InvitePeopleSheet } from "@/features/exchanges/components/InvitePeopleSheet";
import { firstName } from "@/features/joining/copy";
import { approveJoinRequest, declineJoinRequest, removeMember, type DecideResult } from "../actions";
import { NUDGE_COPY, PARTICIPANTS_COPY } from "../copy";
import { memberSubline, requestSubline } from "../format";
import type { JoinRequestLine, NudgeTarget, ParticipantLine } from "../types";
import { NudgeSheet } from "./NudgeSheet";

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
  /**
   * What Nudge needs (GCO-008), or null when readiness could not be read: then no Nudge is offered. `recentIds` are the
   * member ids nudged by anyone in the last 12 hours.
   */
  nudge: { organiserFirst: string; drawDay: string | null; recentIds: readonly string[] } | null;
};

type Pending = { id: string; kind: "approve" | "decline" };

// People needed before names can be drawn (GCO-007, boards Org-People-few and -fewreq).
const MIN_PEOPLE = 3;

// S30 Participants and S31 Remove person (GCO-007, GC-012; boards Org-People-*, Org-Remove-*). The page
// that renders this has already refused everyone but the organiser, and the props carry names, the member
// and request ids, times, addresses and whether a list is attached: no user id, item or reservation, and no
// pair (AC-12, AC-17, AC-41; owner decision 2026-11-15 for the addresses).
// WHY the page re-reads after every change instead of editing local state: the database decides who is in,
// so the list shown is always the one it returns.
export function ParticipantsView({ exchangeId, exchangeName, requests, people, alone, lastJoinDay, inviteUrl, approvalRequired, canManage, nudge }: Props) {
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
  const [nudgeOpen, setNudgeOpen] = useState(false);
  // WHY the targets outlive the sheet: its closing animation still shows their names. Empty means "everyone was nudged recently".
  const [nudgeTargets, setNudgeTargets] = useState<readonly NudgeTarget[]>([]);
  // WHY addresses: a person approved in this visit reads "Joined just now" until the page is reloaded (board
  // Org-People-fewapproved). Their new member row has a new id, so the address is the key that survives the refresh.
  const [justApproved, setJustApproved] = useState<readonly string[]>([]);
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
        if (kind === "approve") {
          toast.show({ message: copy.approvedToast(firstName(request.name)) });
          setJustApproved((all) => [...all, request.email]);
        }
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

  const needWishlist = people.filter((p) => !p.hasWishlist);
  // WHY not the organiser's own row: their list is "Your part", and nobody nudges themselves.
  const nudgeable = nudge && canManage ? needWishlist.filter((p) => !p.isMe) : [];
  const asTarget = (p: ParticipantLine): NudgeTarget => ({ memberId: p.memberId, name: p.name });
  const notRecent = (p: ParticipantLine) => !nudge?.recentIds.includes(p.memberId);
  function openNudge(who: readonly ParticipantLine[]) {
    setNudgeTargets(who.filter(notRecent).map(asTarget));
    setNudgeOpen(true);
  }
  const ready = people.filter((p) => p.hasWishlist);
  const needed = MIN_PEOPLE - people.length;
  const few = !alone && needed > 0;
  // WHY first request only: the card promises "Approve {first} and you'll have the 3", true for one more person only.
  const [firstRequest] = requests;
  const fewReq = few && needed === 1 && canManage && firstRequest !== undefined;

  const inviteAction = inviteUrl ? (
    <Button aria-haspopup="dialog" onClick={() => setInviteOpen(true)}>
      {copy.aloneAction}
    </Button>
  ) : undefined;

  const infoCard = alone ? (
    <PeopleCard title={copy.aloneTitle} body={inviteUrl ? copy.aloneBody(lastJoinDay) : copy.aloneBodyClosed} action={inviteAction} />
  ) : few ? (
    <PeopleCard
      title={copy.fewTitle(needed)}
      body={
        fewReq
          ? inviteUrl
            ? copy.fewReqBody(firstName(firstRequest.name), lastJoinDay)
            : copy.fewReqBodyClosed(firstName(firstRequest.name))
          : inviteUrl
            ? copy.fewBody(lastJoinDay)
            : copy.fewBodyClosed
      }
      // WHY no button on fewreq: the next step is Approve, just below (board Org-People-fewreq).
      action={fewReq ? undefined : inviteAction}
    />
  ) : null;

  function personRow(person: ParticipantLine, index: number) {
    return (
      <ListRow
        key={person.memberId}
        title={person.isMe ? `${person.name} ${copy.you}` : person.name}
        sub={memberSubline({
          email: person.email,
          hasWishlist: person.hasWishlist,
          justJoined: person.email !== null && justApproved.includes(person.email),
        })}
        leading={<Avatar name={person.name} size="row" decorative />}
        divider={index > 0}
        action={
          // WHY no Remove on the organiser's own row: the database refuses it too (22023 organiser); nor once past joining.
          // Nudge is a second sibling target for a person with no list yet (board Org-People-default).
          // WHY no wrapper of our own: ListRow spaces its action targets 12 apart (board UwListItem).
          <>
            {nudgeable.includes(person) ? (
              <Button variant="link" aria-haspopup="dialog" disabled={!online || busy} onClick={() => openNudge([person])}>
                {NUDGE_COPY.nudge}
                <span className="sr-only"> {person.name}</span>
              </Button>
            ) : null}
            {person.isOrganiser || !canManage ? null : (
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
            )}
          </>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-32">
      {failure ? <Alert variant="error">{failure}</Alert> : null}

      {alone ? null : infoCard}

      {requests.length > 0 ? (
        <Section id="wants" title={copy.wantsTitle(requests.length)}>
          {requests.map((request, index) => {
            const mine = pending?.id === request.requestId ? pending.kind : null;
            return (
              <li key={request.requestId} className={cx(index > 0 && "border-t-1 border-border-subtle")}>
                <ul>
                  <ListRow
                    title={request.name}
                    sub={requestSubline(request.email, request.askedLabel)}
                    leading={<Avatar name={request.name} size="row" decorative />}
                  />
                </ul>
                {/* Sibling targets under the row, at natural width on every screen (board Org-People-fewreq). */}
                <div className="flex gap-8 pb-8">
                  {/* WHY: after the event the database refuses Approve (GCO-007), so it is not offered. */}
                  {canManage ? (
                    <Button variant="primary" busy={mine === "approve"} disabled={!online || (busy && mine !== "approve")} onClick={() => decide(request, "approve")}>
                      {copy.approve}
                      <span className="sr-only"> {request.name}</span>
                    </Button>
                  ) : null}
                  <Button variant="text" busy={mine === "decline"} disabled={!online || (busy && mine !== "decline")} onClick={() => decide(request, "decline")}>
                    {copy.decline}
                    <span className="sr-only"> {request.name}</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </Section>
      ) : null}

      {alone ? infoCard : null}

      {alone ? null : (
        <>
          {needWishlist.length > 0 ? (
            <Section
              id="need"
              title={copy.needTitle(needWishlist.length)}
              action={
                // WHY two or more (tester T3-1; board shows "Nudge all 3…"): one person already has their row's Nudge link.
                nudgeable.length > 1 ? (
                  <Button variant="link" aria-haspopup="dialog" disabled={!online || busy} onClick={() => openNudge(nudgeable)}>
                    {NUDGE_COPY.nudgeAll(nudgeable.length)}
                  </Button>
                ) : undefined
              }
            >
              {needWishlist.map(personRow)}
            </Section>
          ) : null}
          {ready.length > 0 ? (
            <Section id="ready" title={copy.readyTitle(ready.length)}>
              {ready.map(personRow)}
            </Section>
          ) : null}
          <Alert variant="privacy">{copy.privacy}</Alert>
        </>
      )}

      {inviteUrl && !alone && !few ? (
        <div>
          <Button variant="secondary" icon={Plus} aria-haspopup="dialog" disabled={!online} onClick={() => setInviteOpen(true)}>
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

      {nudge && canManage ? (
        <NudgeSheet
          open={nudgeOpen}
          onClose={() => setNudgeOpen(false)}
          exchangeId={exchangeId}
          exchangeName={exchangeName}
          organiserFirst={nudge.organiserFirst}
          drawDay={nudge.drawDay}
          targets={nudgeTargets}
        />
      ) : null}

      <Sheet
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        variant="destructive"
        title={removing ? copy.removeTitle(firstName(removing.name), exchangeName) : ""}
        description={removing ? copy.removeBody(firstName(removing.name), removing.email) : undefined}
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

// A list under its heading: a 44-tall heading row at 18 semibold (board Org-People-default).
function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <div className="flex min-h-touch-target items-center justify-between">
        <h2 id={`${id}-heading`} className="text-body-lg-semibold">
          {title}
        </h2>
        {action}
      </div>
      <ul>{children}</ul>
    </section>
  );
}

// The "Nobody has joined yet" and "1 more person needed" cards: 16px body, action at its natural width.
// WHY not EmptyState: its body is 14px and its action is full width on mobile, which these boards don't draw.
function PeopleCard({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <section className="flex flex-col items-start gap-12 rounded-2xl bg-surface-subtle p-24">
      <h2 className="text-heading-4">{title}</h2>
      <p className="text-body-base-regular text-text-secondary">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
