"use client";

import { Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";
import { checkPairs, savePairs } from "../actions";
import { EXCLUSIONS_COPY } from "../copy";
import { addPair, canAddPair, isDirty, removePair, toArrays, verdictFor } from "../draft";
import type { DraftPair, PairablePerson, PairCheck } from "../types";
import { AddPairSheet } from "./AddPairSheet";

type Props = {
  exchangeId: string;
  people: readonly PairablePerson[];
  savedPairs: readonly DraftPair[];
  /** The database's judgement of the saved pairs, or null when it could not be read (then no line shows). */
  initialCheck: PairCheck | null;
};

// GCO-009 Exclusions (S33; boards Org-Excl-empty, -default, -pairfirst, -pairsecond, -impossible, -saved, -two). The
// draft lives here and is thrown away when the organiser leaves (owner decision Q8); only Save pairs writes it. WHY the
// database judges the draft after every change: the engine is the one place that knows whether a fair draw exists
// (GCO-011), and a client copy of it could disagree.
export function ExclusionsView({ exchangeId, people, savedPairs, initialCheck }: Props) {
  const copy = EXCLUSIONS_COPY;
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const [draft, setDraft] = useState<readonly DraftPair[]>(savedPairs);
  const [saved, setSaved] = useState<readonly DraftPair[]>(savedPairs);
  const [check, setCheck] = useState<PairCheck | null>(initialCheck);
  const [sheetOpen, setSheetOpen] = useState(false);
  // WHY a counter: each opening starts the sheet fresh (step one, nothing chosen).
  const [sheetKey, setSheetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // WHY: when the page re-reads after a refusal and someone has left, start again from what is true now. Done while
  // rendering, not in an effect, so the stale list is never painted.
  const peopleKey = people.map((p) => p.memberId).join(",");
  const [seenPeopleKey, setSeenPeopleKey] = useState(peopleKey);
  if (seenPeopleKey !== peopleKey) {
    setSeenPeopleKey(peopleKey);
    setDraft(savedPairs);
    setSaved(savedPairs);
    setCheck(initialCheck);
  }
  // WHY: answers can arrive out of order; only the newest draft's answer is shown.
  const latest = useRef(0);

  async function recheck(next: readonly DraftPair[]) {
    const seq = ++latest.current;
    // WHY cleared first: the old answer is about another draft, and a wrong line is worse than none.
    setCheck(null);
    try {
      const { first, second } = toArrays(next);
      const result = await checkPairs(exchangeId, first, second);
      if (seq !== latest.current) return;
      if (result.ok) setCheck(result.check);
      else if (result.reason === "signed-out") router.replace(`/login?next=${encodeURIComponent(`/exchanges/${exchangeId}/exclusions`)}`);
      // WHY no line on a failed check (owner Q9): saving stays possible, and the draw checks again.
    } catch {
      if (seq === latest.current) reportNetworkError();
    }
  }

  function change(next: readonly DraftPair[]) {
    setFailure(null);
    setDraft(next);
    void recheck(next);
  }

  // WHY: removing a row destroys the focused bin, and focus would fall to the page top. Hand it to the heading, once,
  // and only when nothing else holds it.
  const previousCount = useRef(draft.length);
  useEffect(() => {
    if (draft.length < previousCount.current && (!document.activeElement || document.activeElement === document.body)) {
      document.getElementById("exclusions-heading")?.focus();
    }
    previousCount.current = draft.length;
  }, [draft.length]);

  async function save() {
    if (busy || !online) return;
    setFailure(null);
    setBusy(true);
    try {
      const { first, second } = toArrays(draft);
      const result = await savePairs(exchangeId, first, second);
      setBusy(false);
      if (result.ok) {
        setSaved(draft);
        toast.show({ message: copy.saved });
        router.refresh();
        return;
      }
      if (result.reason === "signed-out") return router.replace(`/login?next=${encodeURIComponent(`/exchanges/${exchangeId}/exclusions`)}`);
      setFailure(result.reason === "stale" ? copy.stale : result.reason === "locked" ? copy.locked : copy.saveFailed);
      // A refusal means the page is out of date: read it again (the page remounts this with what is true now).
      if (result.reason !== "failed") router.refresh();
    } catch {
      setBusy(false);
      reportNetworkError();
    }
  }

  const verdict = verdictFor(check, draft);
  const addDisabled = !online || busy || !canAddPair(people, draft);

  const addButton = (
    <Button
      variant="secondary"
      icon={Plus}
      disabled={addDisabled}
      onClick={() => {
        setSheetKey((k) => k + 1);
        setSheetOpen(true);
      }}
    >
      {copy.addPair}
    </Button>
  );

  return (
    <div className="flex flex-col gap-24">
      {/* Board Org-Excl-*: intro and privacy are one paragraph at the top. */}
      <p className="text-body-base-regular text-text-secondary">{copy.intro}</p>

      {draft.length === 0 ? (
        <>
          {/* Board Org-Excl-empty-m: plain text, not a title+body component. */}
          <p className="text-body-base-regular text-text-secondary">{copy.emptyText}</p>
          <div>{addButton}</div>
        </>
      ) : (
        <div className="flex flex-col gap-16">
          <ul aria-label={copy.listLabel}>
            {draft.map((pair, index) => (
              <ListRow
                key={`${pair.firstId}|${pair.secondId}`}
                title={copy.pairLine(pair.firstName, pair.secondName)}
                sub={copy.pairSub}
                leading={
                  <span className="flex shrink-0 items-center">
                    <Avatar name={pair.firstName} size="row" decorative />
                    <Avatar name={pair.secondName} size="row" decorative className="-ml-6" />
                  </span>
                }
                divider={index > 0}
                action={
                  <Button
                    variant="icon"
                    icon={Trash}
                    label={copy.removeLabel(pair.firstName, pair.secondName)}
                    disabled={!online || busy}
                    onClick={() => change(removePair(draft, pair.firstId, pair.secondId))}
                  />
                }
              />
            ))}
          </ul>
          {/* Board Org-Excl-default-m: verdict line sits between the pair list and the Add button. */}
          {/* WHY always mounted: a screen reader announces the line when the check's answer lands in it. */}
          <div aria-live="polite" className="flex flex-col gap-12">
            {verdict.kind === "fair" ? (
              <p className="text-body-base-regular text-text-secondary">{copy.fair}</p>
            ) : null}
            {verdict.kind === "few" ? <p className="text-body-base-regular text-text-secondary">{copy.tooFew}</p> : null}
            {verdict.kind === "relax" ? (
              <Alert
                variant="error"
                action={
                  <Button
                    variant="link"
                    disabled={!online || busy}
                    onClick={() => change(removePair(draft, verdict.pair.firstId, verdict.pair.secondId))}
                  >
                    {copy.removeThatPair}
                  </Button>
                }
              >
                {copy.relax(verdict.pair.firstName, verdict.pair.secondName)}
              </Alert>
            ) : null}
            {verdict.kind === "unfixable" ? <Alert variant="error">{copy.unfixable}</Alert> : null}
          </div>
          <div className="flex flex-col md:items-start">{addButton}</div>
        </div>
      )}

      {/* Board Org-Excl-empty-m: the too-few line shows outside the pair list when there are no pairs yet. */}
      {draft.length === 0 ? (
        <div aria-live="polite">
          {verdict.kind === "few" ? <p className="text-body-base-regular text-text-secondary">{copy.tooFew}</p> : null}
        </div>
      ) : null}

      {failure ? <Alert variant="error">{failure}</Alert> : null}

      <div className="flex flex-col md:items-start">
        <Button fullWidth busy={busy} disabled={!online || !isDirty(draft, saved)} onClick={save} className="md:w-auto">
          {copy.save}
        </Button>
      </div>

      <AddPairSheet
        key={sheetKey}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        people={people}
        draft={draft}
        onAdd={(first, second) => change(addPair(draft, first, second))}
      />
    </div>
  );
}
