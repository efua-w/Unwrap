"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { deleteWishlist } from "../actions";
import { quoted, WISHLIST_COPY } from "../copy";
import type { OwnerWishlist } from "../types";

// GC-019 delete / S24. Boards: Wishlist-List-delete, -deletebusy, -deleteoffline. A list that is in
// an exchange gets the GC-030 confirmation in slice 16; no list can be attached before slice 5.
const COPY = {
  title: (name: string) => `Delete ${quoted(name)}?`,
  // Owner 2026-11-05 (Q6): a Private list gets the first sentence only.
  body: "It isn't in any exchange, so nothing else changes.",
  bodyLink: "Anyone with the link will see that it's gone.",
  confirm: "Delete list",
  keep: "Keep list",
  offline: "You're offline. You can delete this list once you're back online.",
};

type Props = {
  open: boolean;
  onClose: () => void;
  list: OwnerWishlist;
  onDeleted: () => void;
};

export function DeleteWishlistSheet({ open, onClose, list, onDeleted }: Props) {
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleDelete() {
    if (busy || !online) return;
    setFailed(false);
    setBusy(true);
    try {
      const result = await deleteWishlist(list.id);
      if (result.ok) {
        onDeleted();
        return;
      }
      setBusy(false);
      if (result.reason === "signed-out") {
        return router.replace(`/login?next=${encodeURIComponent(`/wishlists/${list.id}`)}`);
      }
      setFailed(true);
    } catch {
      setBusy(false);
      reportNetworkError();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="destructive"
      title={COPY.title(list.name)}
      description={list.visibility === "link" ? `${COPY.body} ${COPY.bodyLink}` : COPY.body}
      busy={busy}
      footer={
        <>
          {online ? null : <p className="text-body-sm-regular text-text-secondary">{COPY.offline}</p>}
          <Button variant="destructive" fullWidth busy={busy} disabled={!online} onClick={handleDelete}>
            {COPY.confirm}
          </Button>
          <Button variant="text" fullWidth onClick={onClose} disabled={busy}>
            {COPY.keep}
          </Button>
        </>
      }
    >
      {failed ? <Alert variant="error">{WISHLIST_COPY.failed}</Alert> : null}
    </Sheet>
  );
}
