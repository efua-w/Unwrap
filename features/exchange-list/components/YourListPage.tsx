"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { ExchangeTag, type ExchangeTint } from "@/components/ui/ExchangeTag";
import { ListRow } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { removeWishlistItem } from "@/features/wishlists/actions";
import { ItemSheet, type ItemSheetActions } from "@/features/wishlists/components/ItemSheet";
import { WISHLIST_COPY } from "@/features/wishlists/copy";
import type { BudgetPreset } from "@/lib/money/budget";
import {
  addIdeaItem,
  attachWishlistToExchange,
  detachWishlistFromExchange,
  startExchangeIdeas,
  updateIdeaItem,
  type AddIdeaResult,
  type AttachResult,
  type DetachResult,
  type IdeasResult,
} from "../actions";
import {
  addedDetachedToast,
  addedToast,
  afterListIntro,
  attachFailed,
  budgetGuide,
  itemSheetAttachedNote,
  LIST_COPY,
  priceHelper,
  reattachedToast,
  removeTitle,
  restoredToast,
  savedToast,
  switchedToast,
  switchFailed,
  wishlistRemovedToast,
} from "../copy";
import type { ListMode, MyExchangeList, MyIdeas } from "../types";
import { IdeasList, useIdeaRows } from "./IdeasList";
import { WishlistPickerSheet, type UseOutcome } from "./WishlistPickerSheet";

type Props = {
  mode: ListMode;
  /** Participant only: the page was reached from Join, so Skip for now and the You're in page apply (Q11). */
  fromJoin: boolean;
  exchange: { id: string; name: string; tint: ExchangeTint; budget: BudgetPreset; afterDraw: boolean };
  myList: MyExchangeList;
  ideas: MyIdeas;
  /** The row for an attached wishlist or kept list ("6 items · updated Sat 31 Oct"). */
  current: { title: string; sub: string } | null;
  /** How many personal wishlists the person has (none: the no-wishlists state; one: nothing to switch to). */
  wishlistCount: number;
  /** The attached personal list, so the picker does not preselect it. */
  currentWishlistId: string | null;
  timeZone: string;
};

type Failed = { kind: "attach"; id: string; name: string } | { kind: "switch"; name: string; old: string };
type Previous = { id: string; name: string };

// GC-010 / S11 and GCO-004 / S49: one page for participants and for an organiser who takes part. Boards:
// My-List-* (participant, in-app) and Org-List-* (organiser), which share one layout; Joining-Attach-* for
// the from-Join page, which keeps its own header, copy and navigation (`toJoined`). WHY the server decides
// which list is attached: this page only asks the database to attach (attach_wishlist,
// use_exchange_ideas) and shows what get_my_exchange_list answered, so a refused attach shows as failed
// and nothing on screen claims a change that did not happen. The in-app page stays put after a change and
// shows a toast with Undo (owner 2026-11-16); Undo calls the same attach, detach and restore actions.
// After the draw (slice 11, GC-010; boards Joining-Attach-drawn, -drawnlist, -remove, -removed) the same page: no Skip, no
// switching (a list can be added only when nothing is attached, so the way to change is Remove wishlist…, then add), and
// Remove wishlist… for a personal list only (a kept list and ideas are not removed from here; the database refuses both).
export function YourListPage({
  mode,
  fromJoin,
  exchange,
  myList,
  ideas,
  current,
  wishlistCount,
  currentWishlistId,
  timeZone,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const organiser = mode === "organiser";
  const toJoined = !organiser && fromJoin;
  const afterDraw = exchange.afterDraw;
  const exchangePath = `/exchanges/${exchange.id}`;
  const ownPath = organiser ? `${exchangePath}/my-list` : `${exchangePath}/list`;
  const actionsRef = useRef<HTMLDivElement>(null);

  const [ideasListId, setIdeasListId] = useState(ideas.listId);
  const [sessions, setSessions] = useState({ picker: 0, item: 0 });
  const [picker, setPicker] = useState<{ open: boolean; note?: string }>({ open: false });
  const [itemSheet, setItemSheet] = useState<{ open: boolean; item?: MyIdeas["items"][number]; note?: string }>({
    open: false,
  });
  const [failed, setFailed] = useState<Failed | null>(null);
  const [busy, setBusy] = useState<"ideas" | "retry" | null>(null);
  const [removal, setRemoval] = useState<{ open: boolean; busy: boolean; failed: boolean }>({ open: false, busy: false, failed: false });

  const signedOut = () => router.replace(`/login?next=${encodeURIComponent(ownPath)}`);
  const rows = useIdeaRows(ideasListId, ideas.items, signedOut, () =>
    setTimeout(() => actionsRef.current?.querySelector("button")?.focus(), 0),
  );

  // The ideas are what is attached (source ideas, or an empty ideas list, source none with an id) and at
  // least one is left. An attached wishlist or kept list shows as the current row instead.
  const ideasAttached = myList.source === "ideas" || (myList.source === "none" && myList.wishlistId !== null);
  const screen: "ideas" | "current" | "choose" =
    myList.source === "wishlist" || myList.source === "kept"
      ? "current"
      : ideasAttached && rows.shown.length > 0
        ? "ideas"
        : "choose";
  // The wishlist an Undo can put back: only a live personal list, never a kept one.
  const attachedList: Previous | null =
    screen === "current" && currentWishlistId && current ? { id: currentWishlistId, name: current.title } : null;
  const noLists = wishlistCount === 0;
  // WHY attachedList and not just screen: "current" also covers a kept list (GC-030), where the one wishlist the
  // person has is not attached and must stay choosable.
  const onlyOneList = !toJoined && !afterDraw && attachedList !== null && wishlistCount === 1;
  // WHY: board My-List-picker and -itemfilled disable every page button while a sheet is open or a change
  // is in flight; offline disables them as well (the shell's banner says so).
  const locked = !online || picker.open || itemSheet.open || busy !== null;

  // Where the person goes once their list is set on the from-Join page: You're in.
  function finishJoin() {
    router.push(`${exchangePath}/joined`);
  }

  // Where Done goes: You're in from Join, otherwise back to the exchange page, which shows the toast (GCO-004 S49 update).
  function done(message: string) {
    if (toJoined) return finishJoin();
    toast.show({ message });
    router.push(exchangePath);
  }

  // Undo runs the same actions as the change it undoes. WHY a failed Undo says so with Try again: the toast
  // must not claim a change that the database refused.
  async function undo(run: () => Promise<AttachResult | IdeasResult>) {
    let ok = false;
    try {
      const result = await run();
      if (!result.ok && result.reason === "signed-out") return signedOut();
      ok = result.ok;
    } catch {
      reportNetworkError();
    }
    if (!ok) {
      toast.show({ message: WISHLIST_COPY.rollback, action: { label: WISHLIST_COPY.retry, onAction: () => undo(run) }, above: "actions" });
    }
  }

  const reattach = (list: Previous) => () => attachWishlistToExchange(exchange.id, list.id);

  // Remove wishlist… (GC-010 after the draw). WHY Undo is a plain re-attach: the list, its items and the giver's marks stay.
  async function removeList() {
    if (!attachedList || removal.busy) return;
    const previous = attachedList;
    setRemoval({ open: true, busy: true, failed: false });
    let result: DetachResult | null = null;
    try {
      result = await detachWishlistFromExchange(exchange.id);
    } catch {
      reportNetworkError();
    }
    if (result?.ok) {
      setRemoval({ open: false, busy: false, failed: false });
      toast.show({
        message: wishlistRemovedToast(exchange.name),
        action: { label: WISHLIST_COPY.undo, onAction: () => void undo(reattach(previous)) },
        above: "actions",
      });
      return;
    }
    if (result && !result.ok && result.reason === "signed-out") return signedOut();
    // WHY a refresh and no explanation: not-found, kept, ideas and not-available all mean this page is out of date.
    if (result && !result.ok && result.reason !== "failed") {
      setRemoval({ open: false, busy: false, failed: false });
      router.refresh();
      return;
    }
    setRemoval({ open: true, busy: false, failed: true });
  }

  async function attach(id: string, name: string): Promise<UseOutcome> {
    try {
      const result = await attachWishlistToExchange(exchange.id, id);
      if (!result.ok && result.reason === "attached") {
        // WHY: another tab attached a list since this page loaded. Show what is there now.
        toast.show({ message: LIST_COPY.alreadyAttached, above: "actions" });
        router.refresh();
        return "ok";
      }
      if (result.ok) {
        if (toJoined) {
          finishJoin();
          return "navigating";
        }
        if (screen === "current" && attachedList) {
          toast.show({
            message: switchedToast(name),
            action: { label: WISHLIST_COPY.undo, onAction: () => void undo(reattach(attachedList)) },
            above: "actions",
          });
        } else if (screen === "ideas") {
          toast.show({
            message: reattachedToast(name),
            action: { label: WISHLIST_COPY.undo, onAction: () => void undo(() => startExchangeIdeas(exchange.id)) },
            above: "actions",
          });
        } else {
          toast.show({ message: afterDraw ? LIST_COPY.afterToastAttached : LIST_COPY.toastAttached, above: "actions" });
        }
        return "ok";
      }
      if (result.reason === "signed-out") {
        signedOut();
        return "navigating";
      }
      return result.reason === "not-found" ? "gone" : "failed";
    } catch {
      reportNetworkError();
      return "failed";
    }
  }

  async function retry() {
    if (failed?.kind !== "attach" || busy) return;
    setBusy("retry");
    const outcome = await attach(failed.id, failed.name);
    if (outcome === "ok") setFailed(null);
    // "navigating" means the page is moving on; anything else leaves the line in place, nothing changed.
    if (outcome !== "navigating") setBusy(null);
  }

  // "Add items instead". With items kept from before, they come straight back. Otherwise the Add an item
  // sheet opens, and nothing changes until an item is saved. WHY the ideas list is made when the item is
  // saved, not before: Cancel must leave a wishlist attached (boards My-List-itemempty, -emptyitem).
  async function startIdeas() {
    if (locked) return;
    if (ideas.items.length === 0) return openItemSheet();
    setBusy("ideas");
    let listId: string | null = null;
    try {
      const result = await startExchangeIdeas(exchange.id);
      if (result.ok) listId = result.listId;
      else if (result.reason === "signed-out") return signedOut();
    } catch {
      reportNetworkError();
    }
    setBusy(null);
    if (!listId) {
      toast.show({ message: WISHLIST_COPY.saveFailed, action: { label: WISHLIST_COPY.retry, onAction: startIdeas }, above: "actions" });
      return;
    }
    setIdeasListId(listId);
    if (attachedList) {
      toast.show({
        message: restoredToast(ideas.items.length, attachedList.name),
        action: { label: WISHLIST_COPY.undo, onAction: () => void undo(reattach(attachedList)) },
        above: "actions",
      });
    }
  }

  function openItemSheet(item?: MyIdeas["items"][number]) {
    setSessions((s) => ({ ...s, item: s.item + 1 }));
    // WHY the note is fixed when the sheet opens: saving attaches the ideas, which changes the screen under it.
    const note = toJoined ? LIST_COPY.itemSheetNote : attachedList && !item ? itemSheetAttachedNote(attachedList.name) : undefined;
    setItemSheet({ open: true, item, note });
  }

  function openPicker() {
    setFailed(null);
    setSessions((s) => ({ ...s, picker: s.picker + 1 }));
    setPicker({ open: true, note: !toJoined && screen === "ideas" ? LIST_COPY.ideasPickerNote : undefined });
  }

  // Remembers the id the last add returned, and what it displaced, so the toast's Undo can undo both.
  const lastAdded = useRef<{ id: string; listId: string; displaced: Previous | null } | null>(null);
  const itemActions: ItemSheetActions = {
    add: async (input): Promise<AddIdeaResult> => {
      lastAdded.current = null;
      let listId = ideasListId;
      const displaced = attachedList;
      if (screen !== "ideas" || !listId) {
        const started = await startExchangeIdeas(exchange.id);
        if (!started.ok) {
          return { ok: false, reason: started.reason === "signed-out" || started.reason === "not-found" ? started.reason : "failed" };
        }
        listId = started.listId;
        setIdeasListId(listId);
      }
      const result = await addIdeaItem(exchange.id, listId, input);
      if (result.ok) lastAdded.current = { id: result.id, listId, displaced };
      // WHY: starting the ideas took the wishlist off; a refused item must not leave that done.
      else if (displaced && result.reason !== "invalid") await attachWishlistToExchange(exchange.id, displaced.id).catch(() => null);
      return result;
    },
    update: (itemId, input) => updateIdeaItem(exchange.id, itemId, input),
  };

  function onItemSaved(name: string, savedMode: "added" | "saved") {
    setItemSheet({ open: false });
    if (savedMode === "saved") {
      toast.show({ message: savedToast(name), above: "actions" });
      return;
    }
    const added = lastAdded.current;
    if (added?.displaced) {
      const { id, listId, displaced } = added;
      // WHY: a retry after the remove succeeded must only attach; the item is already gone, so removing again says not-found.
      let removedItem = false;
      toast.show({
        message: addedDetachedToast(name, displaced.name),
        action: {
          label: WISHLIST_COPY.undo,
          onAction: () =>
            void undo(async (): Promise<AttachResult> => {
              if (!removedItem) {
                const removed = await removeWishlistItem(listId, id);
                if (!removed.ok) return { ok: false, reason: removed.reason === "signed-out" ? "signed-out" : "failed" };
                removedItem = true;
              }
              return attachWishlistToExchange(exchange.id, displaced.id);
            }),
        },
        above: "actions",
      });
      return;
    }
    toast.show({
      message: addedToast(name),
      action: added
        ? {
            label: WISHLIST_COPY.undo,
            onAction: () => {
              const row = rows.shown.find((r) => r.id === added.id);
              if (row) void rows.remove(row);
            },
          }
        : undefined,
      above: "actions",
    });
  }

  const intro = afterDraw
    ? screen === "choose"
      ? LIST_COPY.afterChooseIntro
      : afterListIntro(screen === "ideas" ? rows.shown.length : myList.itemCount)
    : toJoined || screen === "choose"
      ? budgetGuide(toJoined ? "join" : "app", exchange.budget)
      : screen === "current"
        ? LIST_COPY.currentIntro
        : LIST_COPY.ideasIntro;
  // WHY: a kept list cannot be removed or replaced after the draw, and ideas are removed item by item, so the bar is empty then.
  const showBar = !(afterDraw && screen === "current" && !attachedList);

  // Buttons share one wrapping row on desktop, auto width (boards My-List-*-d).
  const wide = "md:w-auto";

  return (
    <div className="flex flex-1 flex-col gap-32 md:max-w-dialog">
      {toJoined ? (
        <>
          <div className="flex items-center gap-12 rounded-2xl bg-surface-subtle p-16">
            <ExchangeTag name={exchange.name} tint={exchange.tint} size="header" />
            <p className="flex min-w-0 flex-col">
              <span className="text-body-sm-regular text-text-muted">{LIST_COPY.youJoined}</span>
              <span className="break-words text-body-base-semibold">{exchange.name}</span>
            </p>
          </div>
          <header className="flex flex-col gap-8">
            <h1 className="text-heading-2">{LIST_COPY.participantTitle}</h1>
            <p className="text-body-base-regular text-text-secondary">{intro}</p>
          </header>
        </>
      ) : (
        <>
          <header className="flex flex-col gap-8">
            <h1 className="text-heading-2">{afterDraw && screen === "choose" ? LIST_COPY.participantTitle : LIST_COPY.organiserTitle}</h1>
            <p className="flex items-center gap-12">
              <ExchangeTag name={exchange.name} tint={exchange.tint} size="sm" />
              <span className="min-w-0 break-words text-body-base-semibold text-text-secondary">{exchange.name}</span>
            </p>
          </header>
          <p className="text-body-base-regular text-text-secondary">{intro}</p>
        </>
      )}

      {screen === "ideas" ? (
        <IdeasList
          items={rows.shown}
          working={rows.working}
          onEdit={openItemSheet}
          onRemove={rows.remove}
          footer={
            toJoined || afterDraw ? null : (
              <Button variant="link" disabled={locked} aria-haspopup="dialog" onClick={openPicker}>
                {LIST_COPY.chooseInstead}
              </Button>
            )
          }
        />
      ) : null}

      {screen === "current" && current ? (
        <section aria-labelledby="current-heading" className="flex flex-col gap-4">
          {toJoined ? (
            <>
              <h2 id="current-heading" className="text-body-base-semibold text-text-default">
                {LIST_COPY.organiserTitle}
              </h2>
              <p className="text-body-sm-regular text-text-muted">{LIST_COPY.currentIntro}</p>
            </>
          ) : (
            <div className="flex min-h-touch-target items-center">
              <h2 id="current-heading" className="text-body-lg-semibold">
                {LIST_COPY.attachedHeading}
              </h2>
            </div>
          )}
          <ul>
            <ListRow title={current.title} sub={current.sub} />
          </ul>
        </section>
      ) : null}

      {screen === "choose" && noLists ? (
        <p className="text-body-base-regular text-text-secondary">{LIST_COPY.noLists}</p>
      ) : null}

      {onlyOneList ? (
        <div className="flex flex-wrap items-center gap-x-8">
          <p className="text-body-sm-regular text-text-muted">{LIST_COPY.onlyOne}</p>
          <Button variant="link" href="/wishlists">
            {LIST_COPY.goToWishlists}
          </Button>
        </div>
      ) : null}

      {failed?.kind === "switch" ? <Alert variant="error">{switchFailed(failed.name, failed.old)}</Alert> : null}
      {failed?.kind === "attach" ? (
        <Alert
          variant="error"
          action={
            <Button variant="link" busy={busy === "retry"} disabled={!online} onClick={retry}>
              {LIST_COPY.tryAgain}
            </Button>
          }
        >
          {attachFailed(failed.name)}
        </Alert>
      ) : null}

      <Alert variant="privacy">{afterDraw ? LIST_COPY.afterPrivacy : LIST_COPY.privacy}</Alert>

      {showBar ? (
      <div
        ref={actionsRef}
        className={cx(
          "flex flex-col gap-8 md:flex-row md:flex-wrap md:items-center md:gap-x-16",
          toJoined
            ? "sticky bottom-0 -mx-20 mt-auto bg-surface-default px-20 pb-24 pt-12 md:static md:mx-0 md:p-0"
            : // WHY above the tab bar: boards My-List-*-m pin the bar there on every screen.
              "sticky -mx-20 mt-auto bg-surface-default px-20 pb-16 pt-12 max-md:bottom-control-lg md:static md:mx-0 md:mt-0 md:p-0",
        )}
      >
        {screen === "ideas" ? (
          <>
            <Button fullWidth className={wide} disabled={locked} onClick={() => done(afterDraw ? LIST_COPY.afterToastReady : LIST_COPY.toastReady)}>
              {LIST_COPY.done}
            </Button>
            <Button variant="secondary" fullWidth className={wide} disabled={locked} aria-haspopup="dialog" onClick={() => openItemSheet()}>
              {LIST_COPY.addAnother}
            </Button>
          </>
        ) : screen === "current" && afterDraw ? (
          <Button
            variant="destructive-text"
            fullWidth
            className={wide}
            disabled={locked}
            aria-haspopup="dialog"
            onClick={() => setRemoval({ open: true, busy: false, failed: false })}
          >
            {LIST_COPY.removeWishlist}
          </Button>
        ) : screen === "current" ? (
          <>
            <Button
              variant="secondary"
              fullWidth
              className={wide}
              disabled={locked || onlyOneList}
              aria-haspopup="dialog"
              onClick={openPicker}
            >
              {LIST_COPY.chooseDifferent}
            </Button>
            <Button
              variant={toJoined ? "secondary" : "text"}
              fullWidth
              className={wide}
              busy={busy === "ideas"}
              disabled={locked}
              aria-haspopup="dialog"
              onClick={startIdeas}
            >
              {LIST_COPY.addItems}
            </Button>
          </>
        ) : (
          <>
            {/* WHY Add items first with no wishlists: it is the only thing that can be done (board My-List-emptynolists). */}
            {noLists ? (
              <Button fullWidth className={wide} busy={busy === "ideas"} disabled={locked} aria-haspopup="dialog" onClick={startIdeas}>
                {LIST_COPY.addItems}
              </Button>
            ) : null}
            <Button
              variant={noLists ? "secondary" : "primary"}
              fullWidth
              className={wide}
              disabled={locked || noLists}
              aria-haspopup="dialog"
              onClick={openPicker}
            >
              {LIST_COPY.choose}
            </Button>
            {noLists ? null : (
              <Button
                variant="secondary"
                fullWidth
                className={wide}
                busy={busy === "ideas"}
                disabled={locked}
                aria-haspopup="dialog"
                onClick={startIdeas}
              >
                {LIST_COPY.addItems}
              </Button>
            )}
            {toJoined ? (
              <Button variant="text" fullWidth className={wide} disabled={locked} href={`${exchangePath}/joined`}>
                {LIST_COPY.skip}
              </Button>
            ) : null}
          </>
        )}
      </div>
      ) : null}

      <Sheet
        open={removal.open}
        onClose={() => setRemoval({ open: false, busy: false, failed: false })}
        variant="destructive"
        title={removeTitle(exchange.name)}
        description={LIST_COPY.removeBody}
        busy={removal.busy}
        footer={
          <>
            <Button variant="destructive" fullWidth busy={removal.busy} disabled={!online} onClick={() => void removeList()}>
              {LIST_COPY.removeConfirm}
            </Button>
            <Button variant="text" fullWidth disabled={removal.busy} onClick={() => setRemoval({ open: false, busy: false, failed: false })}>
              {LIST_COPY.removeKeep}
            </Button>
          </>
        }
      >
        {removal.failed ? <Alert variant="error">{LIST_COPY.removeFailed}</Alert> : null}
      </Sheet>

      <WishlistPickerSheet
        key={`picker-${sessions.picker}`}
        open={picker.open}
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
        timeZone={timeZone}
        currentId={currentWishlistId}
        note={picker.note}
        onUse={attach}
        onFailed={(id, name) =>
          setFailed(attachedList && !toJoined ? { kind: "switch", name, old: attachedList.name } : { kind: "attach", id, name })
        }
      />
      <ItemSheet
        key={`item-${sessions.item}`}
        open={itemSheet.open}
        onClose={() => setItemSheet({ open: false })}
        actions={itemActions}
        signedOutNext={ownPath}
        item={itemSheet.item}
        onSaved={onItemSaved}
        description={itemSheet.note}
        priceHelper={priceHelper(exchange.budget)}
      />
    </div>
  );
}
