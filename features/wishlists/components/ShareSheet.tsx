"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RadioGroup, type RadioOption } from "@/components/ui/RadioGroup";
import { Sheet } from "@/components/ui/Sheet";
import { ShareActions } from "@/components/ui/ShareActions";
import { setWishlistVisibility } from "../actions";
import { SHARE_COPY, VISIBILITY_OPTIONS, WISHLIST_COPY, whatsAppHref } from "../copy";
import type { OwnerWishlist, WishlistVisibility } from "../types";

const LINK_ID = "share-sheet-link";

type Props = {
  open: boolean;
  onClose: () => void;
  list: OwnerWishlist;
  /** The list's permanent link, built on the server. Shown only while the list is shared. */
  shareUrl: string;
};

// GC-022 / S23 Share sheet. Boards: Wishlist-Detail-shareprivate, -shareswitching, -sharepublic,
// -sharecopied. Choosing "Anyone with the link" (or "Get a shareable link") saves straight away;
// choosing Private turns sharing off (owner answer 2026-11-08). The link itself is permanent.
// WHY the parent remounts this (a new `key`) for each opening: it starts from the saved value.
export function ShareSheet({ open, onClose, list, shareUrl }: Props) {
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  // `saved` is what the server last confirmed; `target` is what is being saved right now.
  const [saved, setSaved] = useState<WishlistVisibility>(list.visibility);
  const [target, setTarget] = useState<WishlistVisibility | null>(null);
  const [failedTarget, setFailedTarget] = useState<WishlistVisibility | null>(null);
  const busy = target !== null;
  const shown = target ?? saved;
  const isShared = saved === "link";

  async function save(next: WishlistVisibility) {
    if (busy || !online) return;
    setFailedTarget(null);
    setTarget(next);
    try {
      const result = await setWishlistVisibility(list.id, next);
      if (result.ok) {
        setSaved(next);
        setTarget(null);
        return;
      }
      setTarget(null);
      if (result.reason === "signed-out") return router.replace(`/login?next=${encodeURIComponent(`/wishlists/${list.id}`)}`);
      setFailedTarget(next);
    } catch {
      // A Server Action that cannot reach the server throws (GC-029: no offline writes).
      setTarget(null);
      setFailedTarget(next);
      reportNetworkError();
    }
  }

  // WHY the hint changes while saving: the board shows "Saving…" in place of the link option's hint.
  const options: readonly RadioOption<WishlistVisibility>[] = VISIBILITY_OPTIONS.map((option) =>
    option.value === "link" && target === "link" ? { ...option, hint: SHARE_COPY.saving } : option,
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="form"
      title={SHARE_COPY.title(list.name)}
      busy={busy}
      footer={
        <>
          {isShared && !busy ? (
            <>
              <ShareActions url={shareUrl} whatsAppHref={whatsAppHref(list.name, shareUrl)} linkElementId={LINK_ID} />
            </>
          ) : (
            <Button fullWidth busy={target === "link"} disabled={!online || target === "private"} onClick={() => save("link")}>
              {SHARE_COPY.getLink}
            </Button>
          )}
          <Button variant="text" fullWidth onClick={onClose} disabled={busy}>
            {SHARE_COPY.done}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-24">
        {!isShared && !busy ? <p className="text-body-base-regular text-text-secondary">{SHARE_COPY.privateBody}</p> : null}
        <RadioGroup
          legend={SHARE_COPY.visibilityLegend}
          name="share-visibility"
          options={options}
          value={shown}
          onChange={save}
          disabled={busy || !online}
        />
        {isShared && !busy ? (
          <div className="flex flex-col gap-4 rounded-xl bg-surface-subtle px-16 py-12">
            <span className="text-body-sm-regular text-text-muted">{SHARE_COPY.yourLink}</span>
            <span id={LINK_ID} className="break-all text-body-base-semibold">
              {shareUrl}
            </span>
          </div>
        ) : null}
        {failedTarget ? (
          <Alert
            variant="error"
            action={
              <Button variant="link" onClick={() => save(failedTarget)} disabled={!online}>
                {WISHLIST_COPY.retry}
              </Button>
            }
          >
            {WISHLIST_COPY.saveFailed}
          </Alert>
        ) : null}
      </div>
    </Sheet>
  );
}
