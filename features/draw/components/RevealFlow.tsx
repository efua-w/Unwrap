"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { DetailRows } from "@/features/joining/components/DetailRows";
import { InviteFrame } from "@/features/joining/components/InviteFrame";
import { formatNaira } from "@/lib/money/naira";
import { loadRecipient, revealRecipient } from "../actions";
import { DRAW_COPY } from "../copy";
import { recipientFirst } from "../format";
import { clearHidden, deviceStore, setHidden } from "../storage";
import type { Recipient } from "../types";
import { useDeviceHidden } from "../use-device-hidden";

type Props = {
  exchangeId: string;
  exchangeName: string;
  assignmentId: string;
  /** From the database: the giver has tapped Reveal at least once, on any device. Never the name. */
  revealedBefore: boolean;
  /** "₦15,000 to ₦25,000" and "Sat 19 Dec", ready to print. */
  spend: string;
  giftDay: string;
  zoneLine: string;
  closeHref: string;
};

// GC-014 Reveal (S15; boards Exchange-Reveal-before, -opening, -revealed, -empty, -error, -offline). WHY a client component
// fed by Server Actions: the recipient's name must never be in the page's server-rendered HTML (AC-12), so the server
// sends this component everything except the person, and the person arrives only after the giver taps (or, for a giver who
// revealed before and has not hidden it on this device, as soon as the page mounts). WHY "Hide again" is per device and in
// localStorage keyed by the assignment id: it is a courtesy against shoulder-surfing, not access control (the database
// still answers the giver). Q7: no "View their wishlist" yet, and Most wanted items are plain rows.
export function RevealFlow({ exchangeId, exchangeName, assignmentId, revealedBefore, spend, giftDay, zoneLine, closeHref }: Props) {
  const copy = DRAW_COPY;
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const device = useDeviceHidden(assignmentId);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // WHY auto-load: a giver who revealed before, on any device, and has not hidden it here sees the person straight away.
  const autoLoad = revealedBefore && device === "shown" && recipient === null && !failed && !opening;
  // The screen follows from the facts, so there is no state machine to drift.
  const screen: "loading" | "revealed" | "check" =
    recipient !== null && device !== "hidden"
      ? "revealed"
      : revealedBefore && (device === "pending" || autoLoad)
        ? "loading"
        : "check";

  function toLogin() {
    router.replace(`/login?next=${encodeURIComponent(`/exchanges/${exchangeId}/reveal`)}`);
  }

  useEffect(() => {
    if (!autoLoad) return;
    let cancelled = false;
    loadRecipient(exchangeId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setRecipient(result.recipient);
        else if (result.reason === "signed-out") toLogin();
        else setFailed(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        reportNetworkError();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, exchangeId]);

  // WHY: Hide again in another tab flips the device flag to hidden here without hideAgain running, and the name must not
  // stay in this page's state (same as hideAgain, review R1-10).
  // WHY in render and not an effect: React re-renders at once with the state dropped, so the name is never painted hidden.
  if (device === "hidden" && recipient !== null) setRecipient(null);

  // WHY: moving to the revealed or check screen replaces the heading, so focus goes to the new one (screen readers and keyboards).
  useEffect(() => {
    if (screen !== "loading") headingRef.current?.focus();
  }, [screen]);

  async function reveal() {
    if (opening || !online) return;
    setFailed(false);
    setOpening(true);
    try {
      const result = await revealRecipient(exchangeId);
      setOpening(false);
      if (result.ok) {
        clearHidden(deviceStore(), assignmentId);
        setRecipient(result.recipient);
        return;
      }
      if (result.reason === "signed-out") return toLogin();
      setFailed(true);
    } catch {
      setOpening(false);
      setFailed(true);
      reportNetworkError();
    }
  }

  function hideAgain() {
    setHidden(deviceStore(), assignmentId);
    // WHY dropped from state: the name is not kept in the page once the giver hides it.
    setRecipient(null);
    setFailed(false);
  }

  const close = { href: closeHref, label: copy.closeLabel };

  if (screen === "loading") {
    return (
      <InviteFrame close={close}>
        <h1 className="sr-only">{copy.loadingRecipient}</h1>
        <SkeletonRegion>
          <Skeleton shape="block" />
          <Skeleton shape="line" text="lg" className="w-2/3" />
          <Skeleton shape="row" />
        </SkeletonRegion>
      </InviteFrame>
    );
  }

  if (screen === "revealed" && recipient) {
    const first = recipientFirst(recipient);
    return (
      <InviteFrame
        close={close}
        footer={
          <Button variant="text" fullWidth onClick={hideAgain}>
            {copy.hideAgain}
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-12 text-center">
          <Avatar name={recipient.displayName} size="profile" decorative />
          <h1 ref={headingRef} tabIndex={-1} className="flex flex-col items-center gap-4 focus:outline-none">
            <span className="text-body-base-regular text-text-secondary">{copy.buyingFor}</span>
            <span className="break-words font-heading text-heading-2">{recipient.displayName}</span>
          </h1>
        </div>
        <DetailRows
          rows={[
            { label: copy.spend, value: spend },
            { label: copy.giftsLabel, value: giftDay },
          ]}
          zoneLine={zoneLine}
        />
        {recipient.listState === "none" ? (
          <p className="text-body-base-regular text-text-secondary">{copy.noList(first)}</p>
        ) : recipient.listState === "empty" ? (
          <section aria-labelledby="mw-heading" className="flex flex-col gap-4">
            <h2 id="mw-heading" className="text-heading-4">
              {copy.mostWanted}
            </h2>
            <p className="text-body-base-regular text-text-secondary">{copy.mostWantedEmpty(first)}</p>
          </section>
        ) : recipient.mostWanted.length > 0 ? (
          <section aria-labelledby="mw-heading" className="flex flex-col gap-4">
            <h2 id="mw-heading" className="text-heading-4">
              {copy.mostWanted}
            </h2>
            <ul>
              {recipient.mostWanted.map((item, i) => (
                <ListRow
                  key={`${i}-${item.name}`}
                  title={item.name}
                  sub={copy.mostWantedSub(item.priceKobo === null ? null : formatNaira(item.priceKobo))}
                  divider={i > 0}
                />
              ))}
            </ul>
          </section>
        ) : null}
        <p className="text-body-sm-regular text-text-muted">{copy.onlyYou(first)}</p>
      </InviteFrame>
    );
  }

  return (
    <InviteFrame
      close={close}
      footer={
        <>
          <Button variant="brand" fullWidth busy={opening} disabled={!online} onClick={reveal}>
            {copy.reveal}
          </Button>
          <Button variant="text" fullWidth href={closeHref} disabled={opening}>
            {copy.notNowReveal}
          </Button>
        </>
      }
    >
      <div className="relative flex flex-col justify-end gap-8 overflow-hidden rounded-2xl bg-surface-inverse px-24 pb-24 pt-120">
        <span aria-hidden="true" className="absolute inset-y-0 right-64 w-12 bg-surface-brand" />
        <span aria-hidden="true" className="absolute inset-x-0 top-40 h-12 bg-surface-brand" />
        <div className="relative flex flex-col gap-8">
          {opening ? (
            <span role="status" className="break-words text-body-sm-semibold text-text-brand-inverse">
              {copy.untying}
            </span>
          ) : (
            <span className="break-words text-body-sm-semibold text-text-brand-inverse">{exchangeName}</span>
          )}
          <span className="font-heading text-heading-3 text-text-inverse">{copy.waiting}</span>
        </div>
      </div>
      <div className="flex flex-col gap-8">
        <h1 ref={headingRef} tabIndex={-1} className="text-heading-2 focus:outline-none">
          {copy.checkTitle}
        </h1>
        <p className="text-body-base-regular text-text-secondary">{copy.checkBody}</p>
      </div>
      <Alert variant="privacy">{copy.checkPrivacy}</Alert>
      {failed ? <Alert variant="error">{copy.revealError}</Alert> : null}
      {!online ? <p className="text-body-base-regular text-text-secondary">{copy.revealOffline}</p> : null}
    </InviteFrame>
  );
}
