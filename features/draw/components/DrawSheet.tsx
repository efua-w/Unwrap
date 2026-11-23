"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { drawNames } from "../actions";
import { DRAW_COPY } from "../copy";
import { peopleStillNeeded } from "../format";

// What the sheet needs, all of it organiser-only data the page already reads for the organiser.
export type DrawSheetData = {
  exchangeId: string;
  exchangeName: string;
  /** People taking part, the organiser included when they take part. */
  peopleIn: number;
  /** The organiser takes part: "You and Ifeoma are in". */
  takingPart: boolean;
  /** First names of the other people taking part. */
  otherNames: readonly string[];
  /** Null when readiness could not be read: the body then leaves the wishlist sentence out. */
  wishlists: { inCount: number; missingNames: readonly string[] } | null;
  /** Null when the Exclusions row is not shown. `onlyPair` is set when there is exactly one pair. */
  exclusions: { count: number; onlyPair: { first: string; second: string } | null } | null;
  /** The last day people can join, or null once joining has closed. */
  lastJoinDay: string | null;
};

type Props = DrawSheetData & {
  open: boolean;
  onClose: () => void;
  /** Opens Invite people. Absent once joining has closed. */
  onInvite?: () => void;
};

type Late = null | "few" | "exclusions" | "ended";

// GCO-011 Draw names (S35, S36; boards Org-Draw-default, -busy, -error, -offline, -excl, -few, -fewtwo, -just). WHY the
// database decides again: the counts here were true when the page loaded. draw_names checks people, pairs and state
// under the exchange lock, and a refusal turns the sheet into the board that matches (few, exclusions) or refreshes
// the page. WHY busy blocks every way out: a second tap must not draw twice, and the database refuses a second draw too.
export function DrawSheet({
  open,
  onClose,
  onInvite,
  exchangeId,
  exchangeName,
  peopleIn,
  takingPart,
  otherNames,
  wishlists,
  exclusions,
  lastJoinDay,
}: Props) {
  const copy = DRAW_COPY;
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [late, setLate] = useState<Late>(null);

  const few = late === "few" || peopleIn < 3;
  const needed = Math.max(1, peopleStillNeeded(peopleIn));

  function close() {
    setFailed(false);
    setLate(null);
    onClose();
  }

  async function draw() {
    if (busy || !online) return;
    setFailed(false);
    setBusy(true);
    try {
      const result = await drawNames(exchangeId);
      if (result.ok) {
        // Stay busy: the page changes, and nothing may be tapped in between.
        router.push(`/exchanges/${exchangeId}/drawn`);
        return;
      }
      setBusy(false);
      if (result.reason === "signed-out") return router.replace(`/login?next=${encodeURIComponent(`/exchanges/${exchangeId}`)}`);
      if (result.reason === "few" || result.reason === "exclusions" || result.reason === "ended") {
        setLate(result.reason);
        // WHY: the page behind the sheet is out of date (someone left, or the exchange ended).
        router.refresh();
        return;
      }
      setFailed(true);
    } catch {
      setBusy(false);
      reportNetworkError();
    }
  }

  // Board Org-Draw-excl: no fair draw exists, so the way forward is the pairs.
  if (late === "exclusions") {
    return (
      <Sheet
        open={open}
        onClose={close}
        variant="confirm"
        title={copy.exclTitle}
        description={copy.exclBody(exclusions?.count ?? 0, peopleIn)}
        footer={
          <>
            <Button fullWidth href={`/exchanges/${exchangeId}/exclusions`}>
              {copy.exclCta}
            </Button>
            <Button variant="text" fullWidth onClick={close}>
              {copy.notNow}
            </Button>
          </>
        }
      />
    );
  }

  // Boards Org-Draw-few and -fewtwo.
  if (few) {
    const body =
      peopleIn === 0 && !takingPart
        ? copy.fewNobody(exchangeName, lastJoinDay)
        : takingPart
          ? copy.fewWithYou(otherNames, needed, lastJoinDay)
          : copy.fewSome(otherNames, needed, lastJoinDay);
    return (
      <Sheet
        open={open}
        onClose={close}
        variant="confirm"
        title={copy.fewTitle}
        description={body}
        footer={
          <>
            {onInvite ? (
              <Button
                fullWidth
                onClick={() => {
                  close();
                  onInvite();
                }}
              >
                {otherNames.length === 0 && !takingPart ? copy.fewShare : copy.fewInvite}
              </Button>
            ) : null}
            <Button variant={onInvite ? "text" : "primary"} fullWidth onClick={close}>
              {copy.close}
            </Button>
          </>
        }
      />
    );
  }

  const body = busy
    ? copy.busyBody
    : wishlists === null
      ? copy.bodyPlain(peopleIn)
      : wishlists.missingNames.length === 0
        ? wishlists.inCount >= peopleIn
          ? copy.bodyAllIn(peopleIn)
          : copy.bodyPlain(peopleIn)
        : copy.bodyMissing(peopleIn, wishlists.inCount, wishlists.missingNames);
  const pairNote =
    exclusions === null || exclusions.count === 0
      ? null
      : exclusions.onlyPair
        ? copy.noteOnePair(exclusions.onlyPair.first, exclusions.onlyPair.second)
        : copy.noteManyPairs(exclusions.count);

  return (
    <Sheet
      open={open}
      onClose={close}
      variant="confirm"
      busy={busy}
      title={copy.sheetTitle(exchangeName)}
      description={body}
      footer={
        <>
          <Button fullWidth busy={busy} disabled={!online || late === "ended"} onClick={draw}>
            {failed ? copy.tryAgain : copy.draw}
          </Button>
          {exclusions && exclusions.count > 0 ? (
            <Button variant="secondary" fullWidth disabled={busy || !online} href={`/exchanges/${exchangeId}/exclusions`}>
              {copy.editExclusions}
            </Button>
          ) : null}
          <Button variant="text" fullWidth disabled={busy} onClick={close}>
            {copy.notYet}
          </Button>
        </>
      }
    >
      {failed ? <Alert variant="error">{copy.errorNote}</Alert> : null}
      {late === "ended" ? <Alert variant="error">{copy.endedNote}</Alert> : null}
      {!online ? (
        <p className="rounded-xl bg-surface-subtle px-16 py-12 text-body-sm-regular text-text-secondary">{copy.offlineNote}</p>
      ) : pairNote ? (
        <p className="rounded-xl bg-surface-subtle px-16 py-12 text-body-sm-regular text-text-secondary">{pairNote}</p>
      ) : null}
      <Alert variant="privacy">{copy.privacy}</Alert>
    </Sheet>
  );
}
