"use client";

import { Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";
import { formatNaira } from "@/lib/money/naira";
import { removeWishlistItem, restoreWishlist, restoreWishlistItem } from "../actions";
import { itemCountLabel, quoted, WISHLIST_COPY } from "../copy";
import type { OwnerWishlist, OwnerWishlistItem } from "../types";
import { DeleteWishlistSheet } from "./DeleteWishlistSheet";
import { ItemSheet, PRIORITY_LABEL } from "./ItemSheet";
import { VisibilityChip } from "./VisibilityChip";
import { WishlistSheet } from "./WishlistSheet";

// GC-020 / S21 Wishlist detail (owner). Boards: Wishlist-Detail-default, -bday, -newempty, -newadded,
// -added, -saved, -removed, -savefail, -offline. Not in slice 2: Share (slice 3, owner Q3) and the
// "Your givers in …" line (exchanges, slice 5). The owner never sees purchase marks: the item type has
// no field for them (GC-020).
const COPY = {
  editList: "Edit list",
  order: "Recently changed first",
  addItem: "Add an item",
  deleteList: "Delete list",
  emptyTitle: "Add your first item",
  // Owner 2026-11-08 (b): board copy without "something for the new space" and without its last
  // sentence, which promised link import (Q2).
  emptyBody: "Things that tend to land well: a gadget you've had your eye on, or a voucher for a place you love.",
  remove: (name: string) => `Remove ${name}`,
  added: (name: string) => `Added ${quoted(name)}.`,
  addAnother: "Add another",
  saved: (name: string) => `Saved ${quoted(name)}.`,
  removed: (name: string) => `Removed ${quoted(name)}.`,
};

// "₦8,500 · Most wanted. Any colour but brown." (board row sub line). Exact prices only (GC-020).
function itemSub(item: OwnerWishlistItem): string {
  const head = [item.priceKobo === null ? null : formatNaira(item.priceKobo), PRIORITY_LABEL[item.priority]]
    .filter((part): part is string => part !== null)
    .join(" · ");
  return item.note ? `${head}. ${item.note}` : head;
}

type Sheet =
  | { kind: "none" }
  | { kind: "edit-list" }
  | { kind: "delete" }
  | { kind: "add-item" }
  | { kind: "edit-item"; item: OwnerWishlistItem };

type Props = { list: OwnerWishlist; items: OwnerWishlistItem[] };

export function WishlistDetail({ list, items }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  // WHY a counter per sheet: each opening remounts that sheet, so it starts from the saved values,
  // while a sheet that is closing (Edit list handing over to Delete) is left to close normally.
  const [sessions, setSessions] = useState({ list: 0, delete: 0, item: 0 });

  // WHY: removing a row destroys the focused bin, so focus moves to the next row's target, else the
  // previous one, else "Add an item" (R1-1). Set before the row leaves, applied once it has.
  const focusAfter = useRef<{ rowId: string } | "add" | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const addRef = useRef<HTMLDivElement>(null);

  // Optimistic layer over the server's items (GC-020): rows removed here, rows put back by Undo
  // before the server confirms, and rows whose bin is working.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [putBack, setPutBack] = useState<ReadonlyMap<string, OwnerWishlistItem>>(new Map());
  const [working, setWorking] = useState<ReadonlySet<string>>(new Set());

  const shown = useMemo(() => {
    const byId = new Map<string, OwnerWishlistItem>();
    for (const item of items) if (!hidden.has(item.id)) byId.set(item.id, item);
    for (const item of putBack.values()) if (!hidden.has(item.id) && !byId.has(item.id)) byId.set(item.id, item);
    // WHY: removing or restoring an item moves the list's own updated_at too (the item trigger fires on
    // every update, R1-4), so the list jumps to the top of My wishlists. Accepted; asserted in 100.
    return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [items, hidden, putBack]);

  const signedOut = () => router.replace(`/login?next=${encodeURIComponent(`/wishlists/${list.id}`)}`);

  function open(next: Sheet) {
    const which = next.kind === "edit-list" ? "list" : next.kind === "delete" ? "delete" : "item";
    setSessions((s) => ({ ...s, [which]: s[which] + 1 }));
    setSheet(next);
  }
  const close = () => setSheet({ kind: "none" });

  const withId = (set: ReadonlySet<string>, id: string, on: boolean) => {
    const copy = new Set(set);
    if (on) copy.add(id);
    else copy.delete(id);
    return copy;
  };

  async function remove(item: OwnerWishlistItem) {
    if (working.has(item.id)) return;
    setWorking((s) => withId(s, item.id, true));
    let ok = false;
    try {
      const result = await removeWishlistItem(list.id, item.id);
      ok = result.ok;
      if (!result.ok && result.reason === "signed-out") {
        setWorking((s) => withId(s, item.id, false));
        return signedOut();
      }
    } catch {
      reportNetworkError();
    }
    setWorking((s) => withId(s, item.id, false));
    if (ok) {
      const at = shown.findIndex((row) => row.id === item.id);
      const neighbour = shown[at + 1] ?? shown[at - 1];
      focusAfter.current = neighbour ? { rowId: neighbour.id } : "add";
      setHidden((s) => withId(s, item.id, true));
      toast.show({ message: COPY.removed(item.name), action: { label: WISHLIST_COPY.undo, onAction: () => undoRemove(item) } });
    } else {
      // The row never left, so nothing moves; offer the bin again (GC-020).
      toast.show({ message: WISHLIST_COPY.saveFailed, action: { label: WISHLIST_COPY.retry, onAction: () => remove(item) } });
    }
  }

  // Undo is optimistic: the row comes straight back, and goes again if the server says no.
  async function undoRemove(item: OwnerWishlistItem) {
    setHidden((s) => withId(s, item.id, false));
    setPutBack((m) => new Map(m).set(item.id, item));
    let ok = false;
    let isSignedOut = false;
    try {
      const result = await restoreWishlistItem(list.id, item.id);
      ok = result.ok;
      isSignedOut = !result.ok && result.reason === "signed-out";
    } catch {
      reportNetworkError();
    }
    setPutBack((m) => {
      const copy = new Map(m);
      copy.delete(item.id);
      return copy;
    });
    if (isSignedOut) return signedOut();
    if (!ok) {
      setHidden((s) => withId(s, item.id, true));
      toast.show({ message: WISHLIST_COPY.rollback, action: { label: WISHLIST_COPY.retry, onAction: () => undoRemove(item) } });
    }
  }

  async function undoDelete() {
    let ok = false;
    try {
      const result = await restoreWishlist(list.id);
      ok = result.ok;
      if (!result.ok && result.reason === "signed-out") return signedOut();
    } catch {
      reportNetworkError();
    }
    if (ok) router.refresh();
    else toast.show({ message: WISHLIST_COPY.saveFailed, action: { label: WISHLIST_COPY.retry, onAction: undoDelete } });
  }

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    const el =
      target === "add"
        ? addRef.current?.querySelector<HTMLElement>("button")
        : listRef.current?.querySelector<HTMLElement>(`[data-row-id="${target.rowId}"] > a, [data-row-id="${target.rowId}"] > button`);
    el?.focus();
  }, [hidden]);

  return (
    <div className="flex flex-col gap-24">
      <header className="flex flex-col gap-12">
        <h1 className="break-words text-heading-1">{list.name}</h1>
        <div>
          <VisibilityChip visibility={list.visibility} size="page" />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-16 gap-y-8">
        <Button variant="link" disabled={!online} aria-haspopup="dialog" onClick={() => open({ kind: "edit-list" })}>
          {COPY.editList}
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={COPY.emptyTitle} body={COPY.emptyBody} />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="flex justify-between gap-16 text-body-sm-regular text-text-muted">
            <span>{itemCountLabel(shown.length)}</span>
            <span>{COPY.order}</span>
          </div>
          <ul ref={listRef} className="flex flex-col">
            {shown.map((item, index) => (
              <ListRow
                key={item.id}
                rowId={item.id}
                title={item.name}
                sub={itemSub(item)}
                divider={index > 0}
                onClick={() => open({ kind: "edit-item", item })}
                action={
                  <Button
                    variant="icon"
                    icon={Trash}
                    label={COPY.remove(item.name)}
                    busy={working.has(item.id)}
                    disabled={!online}
                    onClick={() => remove(item)}
                  />
                }
              />
            ))}
          </ul>
        </div>
      )}

      <div ref={addRef} className="flex flex-wrap items-center gap-x-16 gap-y-8">
        <Button icon={Plus} disabled={!online} aria-haspopup="dialog" onClick={() => open({ kind: "add-item" })}>
          {COPY.addItem}
        </Button>
        <Button variant="destructive-text" disabled={!online} aria-haspopup="dialog" onClick={() => open({ kind: "delete" })}>
          {COPY.deleteList}
        </Button>
      </div>

      <WishlistSheet
        key={`list-${sessions.list}`}
        open={sheet.kind === "edit-list"}
        onClose={close}
        list={list}
        onDelete={() => open({ kind: "delete" })}
        // WHY no toast: GC-019 has no copy for saving a list; the new name and label show on the page.
        onSaved={close}
      />
      <DeleteWishlistSheet
        key={`delete-${sessions.delete}`}
        open={sheet.kind === "delete"}
        onClose={close}
        list={list}
        onDeleted={() => {
          close();
          toast.show({
            message: WISHLIST_COPY.deletedToast(list.name),
            action: { label: WISHLIST_COPY.undo, onAction: undoDelete },
          });
          router.push("/wishlists");
        }}
      />
      <ItemSheet
        key={`item-${sessions.item}`}
        open={sheet.kind === "add-item" || sheet.kind === "edit-item"}
        onClose={close}
        wishlistId={list.id}
        item={sheet.kind === "edit-item" ? sheet.item : undefined}
        onSaved={(name, mode) => {
          close();
          if (mode === "added") {
            toast.show({
              message: COPY.added(name),
              action: { label: COPY.addAnother, onAction: () => open({ kind: "add-item" }) },
            });
          } else {
            toast.show({ message: COPY.saved(name) });
          }
        }}
      />
    </div>
  );
}
