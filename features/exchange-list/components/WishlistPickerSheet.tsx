"use client";

import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RadioGroup, type RadioOption } from "@/components/ui/RadioGroup";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { itemCountLabel } from "@/features/wishlists/copy";
import { formatUpdated } from "@/lib/dates/format-updated";
import { listPickerWishlists } from "../actions";
import { LIST_COPY, listGone } from "../copy";
import type { OwnerWishlistSummary } from "../types";

export type UseOutcome = "ok" | "failed" | "gone";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The viewer's own zone, for "updated {date}". */
  timeZone: string;
  /** The list attached now, if any: not preselected, so "Choose a different wishlist" offers another. */
  currentId: string | null;
  /** Attaches the chosen list. "ok" means the page is moving on, so the sheet stays busy. */
  onUse: (id: string) => Promise<UseOutcome>;
  /** The attach failed and nothing changed: the page shows the retry line. */
  onFailed: (id: string, name: string) => void;
};

type Phase = { kind: "loading" } | { kind: "error" } | { kind: "ready"; wishlists: OwnerWishlistSummary[] };

// GC-010 / S11 and S49 picker sheet. Boards: Joining-Attach-picker, -pickerloading, -gone, -attaching and
// Org-List-picker, -pickercurrent, -pickerloading, -attaching. WHY the lists are read when it opens: a
// list deleted in another tab is then not offered, and a deletion that lands while the sheet is open is
// caught by the attach itself ("gone"). The parent remounts this (a new `key`) for each opening.
export function WishlistPickerSheet({ open, onClose, timeZone, currentId, onUse, onFailed }: Props) {
  const { online } = useNetworkStatus();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Shows the lists a read returned (null: it failed). Returns them so the caller can compare after an
  // attach says "gone".
  function apply(wishlists: OwnerWishlistSummary[] | null): OwnerWishlistSummary[] | null {
    if (!wishlists) {
      setPhase({ kind: "error" });
      return null;
    }
    setPhase({ kind: "ready", wishlists });
    // WHY the first list that is not the current one: choosing "a different wishlist" starts on one.
    setValue((previous) =>
      wishlists.some((w) => w.id === previous) ? previous : (wishlists.find((w) => w.id !== currentId)?.id ?? ""),
    );
    return wishlists;
  }

  async function read(): Promise<OwnerWishlistSummary[] | null> {
    try {
      const result = await listPickerWishlists();
      return apply(result.ok ? result.wishlists : null);
    } catch {
      return apply(null);
    }
  }

  // WHY once per opening: the parent remounts the sheet for each opening, so this runs on that mount.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listPickerWishlists()
      .then((result) => {
        if (!cancelled) apply(result.ok ? result.wishlists : null);
      })
      .catch(() => {
        if (!cancelled) apply(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function retryRead() {
    setPhase({ kind: "loading" });
    void read();
  }

  async function use() {
    if (busy || !online || phase.kind !== "ready" || value === "") return;
    const chosen = phase.wishlists.find((w) => w.id === value);
    if (!chosen) return;
    setBusy(true);
    const outcome = await onUse(chosen.id);
    if (outcome === "ok") return;
    if (outcome === "gone") {
      const fresh = await read();
      setBusy(false);
      if (fresh && !fresh.some((w) => w.id === chosen.id)) {
        setNote(listGone(chosen.name));
        return;
      }
      // The list is still there, so the exchange is what changed: say it failed and nothing changed.
    } else {
      setBusy(false);
    }
    onClose();
    onFailed(chosen.id, chosen.name);
  }

  const now = new Date();
  const options: RadioOption<string>[] =
    phase.kind === "ready"
      ? phase.wishlists.map((w) => ({
          value: w.id,
          label: w.name,
          hint: `${itemCountLabel(w.itemCount)} · updated ${formatUpdated(new Date(w.updatedAt), now, timeZone)}`,
        }))
      : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="form"
      title={LIST_COPY.pickerTitle}
      busy={busy}
      footer={
        <>
          <Button fullWidth busy={busy} disabled={!online || phase.kind !== "ready" || value === ""} onClick={use}>
            {LIST_COPY.use}
          </Button>
          <Button variant="text" fullWidth onClick={onClose} disabled={busy}>
            {LIST_COPY.cancel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-24">
        {phase.kind === "loading" ? (
          <SkeletonRegion>
            <Skeleton shape="row" />
            <Skeleton shape="row" />
          </SkeletonRegion>
        ) : phase.kind === "error" ? (
          <Alert
            variant="error"
            action={
              <Button variant="link" onClick={retryRead}>
                {LIST_COPY.tryAgain}
              </Button>
            }
          >
            {LIST_COPY.pickerFailed}
          </Alert>
        ) : options.length === 0 ? (
          <p className="text-body-base-regular text-text-secondary">{LIST_COPY.noLists}</p>
        ) : (
          <RadioGroup
            legend={LIST_COPY.pickerLegend}
            name="exchange-wishlist"
            options={options}
            value={value}
            onChange={setValue}
            disabled={busy}
          />
        )}
        {note ? (
          <p role="status" className="rounded-xl bg-surface-subtle px-16 py-12 text-body-sm-regular text-text-secondary">
            {note}
          </p>
        ) : null}
        <Alert variant="privacy">{LIST_COPY.privacy}</Alert>
      </div>
    </Sheet>
  );
}
