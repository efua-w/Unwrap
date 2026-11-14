"use client";

import { Trash } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";
import { removeWishlistItem, restoreWishlistItem } from "@/features/wishlists/actions";
import { itemSub, WISHLIST_COPY } from "@/features/wishlists/copy";
import { ideasHeading, LIST_COPY, removedToast, removeLabel } from "../copy";
import type { OwnerWishlistItem } from "../types";

// GC-010 "Add items instead": the ideas for this exchange, with the bin and its Undo. Boards:
// Joining-Attach-ideas, -remove (ideas) and Org-List-ideas. The remove and restore functions accept an
// ideas list's items under the same owner rule as a wishlist's (migration exchange_lists).

// WHY a hook: the page decides which screen to show from how many ideas are left, so the rows the person
// sees (the server's items, minus those just removed, plus those just put back) are computed there.
export function useIdeaRows(listId: string | null, items: OwnerWishlistItem[], onSignedOut: () => void, afterRemove: () => void) {
  const router = useRouter();
  const toast = useToast();
  const { reportNetworkError } = useNetworkStatus();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [putBack, setPutBack] = useState<ReadonlyMap<string, OwnerWishlistItem>>(new Map());
  const [working, setWorking] = useState<ReadonlySet<string>>(new Set());

  const shown = useMemo(() => {
    const byId = new Map<string, OwnerWishlistItem>();
    for (const item of items) if (!hidden.has(item.id)) byId.set(item.id, item);
    for (const item of putBack.values()) if (!hidden.has(item.id) && !byId.has(item.id)) byId.set(item.id, item);
    return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [items, hidden, putBack]);

  const withId = (set: ReadonlySet<string>, id: string, on: boolean) => {
    const copy = new Set(set);
    if (on) copy.add(id);
    else copy.delete(id);
    return copy;
  };

  async function remove(item: OwnerWishlistItem) {
    if (!listId || working.has(item.id)) return;
    setWorking((s) => withId(s, item.id, true));
    let ok = false;
    let signedOut = false;
    try {
      const result = await removeWishlistItem(listId, item.id);
      ok = result.ok;
      signedOut = !result.ok && result.reason === "signed-out";
    } catch {
      reportNetworkError();
    }
    setWorking((s) => withId(s, item.id, false));
    if (signedOut) return onSignedOut();
    if (ok) {
      setHidden((s) => withId(s, item.id, true));
      toast.show({ message: removedToast(item.name), action: { label: WISHLIST_COPY.undo, onAction: () => undoRemove(item) } });
      router.refresh();
      afterRemove();
    } else {
      // The row never left, so nothing moves; offer the bin again.
      toast.show({ message: WISHLIST_COPY.saveFailed, action: { label: WISHLIST_COPY.retry, onAction: () => remove(item) } });
    }
  }

  // Undo is optimistic: the row comes straight back, and goes again if the server says no.
  async function undoRemove(item: OwnerWishlistItem) {
    if (!listId) return;
    setHidden((s) => withId(s, item.id, false));
    setPutBack((m) => new Map(m).set(item.id, item));
    let ok = false;
    let signedOut = false;
    try {
      const result = await restoreWishlistItem(listId, item.id);
      ok = result.ok;
      signedOut = !result.ok && result.reason === "signed-out";
    } catch {
      reportNetworkError();
    }
    if (signedOut) return onSignedOut();
    if (ok) {
      router.refresh();
    } else {
      setHidden((s) => withId(s, item.id, true));
      setPutBack((m) => {
        const copy = new Map(m);
        copy.delete(item.id);
        return copy;
      });
      toast.show({ message: WISHLIST_COPY.rollback, action: { label: WISHLIST_COPY.retry, onAction: () => undoRemove(item) } });
    }
  }

  return { shown, working, remove };
}

type Props = {
  items: OwnerWishlistItem[];
  working: ReadonlySet<string>;
  onEdit: (item: OwnerWishlistItem) => void;
  onRemove: (item: OwnerWishlistItem) => void;
};

export function IdeasList({ items, working, onEdit, onRemove }: Props) {
  const { online } = useNetworkStatus();
  return (
    <section aria-labelledby="ideas-heading" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 id="ideas-heading" className="text-body-base-semibold text-text-default">
          {ideasHeading(items.length)}
        </h2>
        <p className="text-body-sm-regular text-text-muted">{LIST_COPY.ideasSub}</p>
      </div>
      <ul className="flex flex-col">
        {items.map((item, index) => (
          <ListRow
            key={item.id}
            rowId={item.id}
            title={item.name}
            sub={itemSub(item)}
            divider={index > 0}
            disabled={!online}
            onClick={() => onEdit(item)}
            action={
              <Button
                variant="icon"
                icon={Trash}
                label={removeLabel(item.name)}
                busy={working.has(item.id)}
                disabled={!online}
                onClick={() => onRemove(item)}
              />
            }
          />
        ))}
      </ul>
    </section>
  );
}
