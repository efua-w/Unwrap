"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { ExchangeTag, type ExchangeTint } from "@/components/ui/ExchangeTag";
import { ListRow } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";
import { ItemSheet, type ItemSheetActions } from "@/features/wishlists/components/ItemSheet";
import { WISHLIST_COPY } from "@/features/wishlists/copy";
import type { BudgetPreset } from "@/lib/money/budget";
import { addIdeaItem, attachWishlistToExchange, updateIdeaItem, startExchangeIdeas } from "../actions";
import { addedToast, attachFailed, budgetGuide, LIST_COPY, priceHelper, savedToast } from "../copy";
import type { ListMode, MyExchangeList, MyIdeas } from "../types";
import { IdeasList, useIdeaRows } from "./IdeasList";
import { WishlistPickerSheet, type UseOutcome } from "./WishlistPickerSheet";

type Props = {
  mode: ListMode;
  /** Participant only: the page was reached from Join, so Skip for now and the You're in page apply (Q11). */
  fromJoin: boolean;
  exchange: { id: string; name: string; tint: ExchangeTint; budget: BudgetPreset };
  myList: MyExchangeList;
  ideas: MyIdeas;
  /** The row for an attached wishlist or kept list ("6 items · updated Sat 31 Oct"). */
  current: { title: string; sub: string } | null;
  /** Whether the person has any personal wishlist at all (the no-wishlists state). */
  hasWishlists: boolean;
  /** The attached personal list, so the picker does not preselect it. */
  currentWishlistId: string | null;
  timeZone: string;
};

type Failed = { id: string; name: string };

// GC-010 / S11 and GCO-004 / S49: one page for participants and for an organiser who takes part. Boards:
// Joining-Attach-* (participant) and Org-List-* (organiser, which supersedes where both exist). The
// organiser has no Skip and goes back to the exchange page; a participant who came from Join skips to
// You're in. WHY the server decides which list is attached: this page only asks the database to attach
// (attach_wishlist, use_exchange_ideas) and shows what get_my_exchange_list answered, so a refused
// attach shows as failed and nothing on screen claims a change that did not happen.
export function YourListPage({
  mode,
  fromJoin,
  exchange,
  myList,
  ideas,
  current,
  hasWishlists,
  currentWishlistId,
  timeZone,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const organiser = mode === "organiser";
  const toJoined = !organiser && fromJoin;
  const exchangePath = `/exchanges/${exchange.id}`;
  const ownPath = organiser ? `${exchangePath}/my-list` : `${exchangePath}/list`;
  const actionsRef = useRef<HTMLDivElement>(null);

  const [ideasListId, setIdeasListId] = useState(ideas.listId);
  const [sessions, setSessions] = useState({ picker: 0, item: 0 });
  const [picker, setPicker] = useState(false);
  const [itemSheet, setItemSheet] = useState<{ open: boolean; item?: MyIdeas["items"][number] }>({ open: false });
  const [failed, setFailed] = useState<Failed | null>(null);
  const [busy, setBusy] = useState<"ideas" | "retry" | null>(null);

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

  // Where the person goes once their list is set. Participants who came from Join see You're in; everyone
  // else goes back to the exchange page, which shows the toast (GCO-004 S49 update).
  function finish(message: string) {
    if (toJoined) {
      router.push(`${exchangePath}/joined`);
      return;
    }
    toast.show({ message });
    router.push(exchangePath);
  }

  async function attach(id: string): Promise<UseOutcome> {
    try {
      const result = await attachWishlistToExchange(exchange.id, id);
      if (result.ok) {
        finish(LIST_COPY.toastAttached);
        return "ok";
      }
      if (result.reason === "signed-out") {
        signedOut();
        return "ok";
      }
      return result.reason === "not-found" ? "gone" : "failed";
    } catch {
      reportNetworkError();
      return "failed";
    }
  }

  async function retry() {
    if (!failed || busy) return;
    setBusy("retry");
    const outcome = await attach(failed.id);
    // "ok" means the page is moving on; anything else leaves the line in place, nothing changed.
    if (outcome !== "ok") setBusy(null);
  }

  // "Add items instead": make or bring back my ideas for this exchange, then open the Add an item sheet
  // when there is nothing yet to show. WHY a separate call from the item insert: see startExchangeIdeas.
  async function startIdeas() {
    if (busy || !online) return;
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
      toast.show({ message: WISHLIST_COPY.saveFailed, action: { label: WISHLIST_COPY.retry, onAction: startIdeas } });
      return;
    }
    setIdeasListId(listId);
    if (ideas.items.length === 0) openItemSheet();
  }

  function openItemSheet(item?: MyIdeas["items"][number]) {
    setSessions((s) => ({ ...s, item: s.item + 1 }));
    setItemSheet({ open: true, item });
  }

  function openPicker() {
    setFailed(null);
    setSessions((s) => ({ ...s, picker: s.picker + 1 }));
    setPicker(true);
  }

  // Remembers the id the last add returned, so the toast's Undo can take that one item back.
  const lastAdded = useRef<string | null>(null);
  const itemActions: ItemSheetActions = {
    add: async (input) => {
      const result = await addIdeaItem(exchange.id, ideasListId, input);
      lastAdded.current = result.ok ? result.id : null;
      return result;
    },
    update: (itemId, input) => updateIdeaItem(exchange.id, itemId, input),
  };

  function onItemSaved(name: string, savedMode: "added" | "saved") {
    setItemSheet({ open: false });
    if (savedMode === "saved") {
      toast.show({ message: savedToast(name) });
      return;
    }
    const itemId = lastAdded.current;
    toast.show({
      message: addedToast(name),
      action: itemId
        ? {
            label: WISHLIST_COPY.undo,
            onAction: () => {
              const added = rows.shown.find((row) => row.id === itemId);
              if (added) void rows.remove(added);
            },
          }
        : undefined,
    });
  }

  const noLists = !hasWishlists;
  // WHY pinned only on the standalone participant page: the organiser's page sits above the tab bar.
  const pinned = toJoined;

  return (
    <div className="flex flex-1 flex-col gap-32">
      {organiser ? null : (
        <div className="flex items-center gap-12 rounded-2xl bg-surface-subtle p-16">
          <ExchangeTag name={exchange.name} tint={exchange.tint} size="header" />
          <p className="flex min-w-0 flex-col">
            <span className="text-body-sm-regular text-text-muted">{LIST_COPY.youJoined}</span>
            <span className="break-words text-body-base-semibold">{exchange.name}</span>
          </p>
        </div>
      )}

      <header className="flex flex-col gap-8">
        <h1 className="text-heading-2">{organiser ? LIST_COPY.organiserTitle : LIST_COPY.participantTitle}</h1>
        {organiser ? <p className="break-words text-body-base-regular text-text-secondary">{exchange.name}</p> : null}
        <p className="text-body-base-regular text-text-secondary">
          {screen === "current" && organiser ? LIST_COPY.currentIntro : budgetGuide(mode, exchange.budget)}
        </p>
      </header>

      {screen === "ideas" ? (
        <IdeasList items={rows.shown} working={rows.working} onEdit={openItemSheet} onRemove={rows.remove} />
      ) : null}

      {screen === "current" && current ? (
        <section aria-labelledby="current-heading" className="flex flex-col gap-4">
          {organiser ? null : (
            <>
              <h2 id="current-heading" className="text-body-base-semibold text-text-default">
                {LIST_COPY.organiserTitle}
              </h2>
              <p className="text-body-sm-regular text-text-muted">{LIST_COPY.currentIntro}</p>
            </>
          )}
          {organiser ? <h2 id="current-heading" className="sr-only">{LIST_COPY.organiserTitle}</h2> : null}
          <ul>
            <ListRow title={current.title} sub={current.sub} />
          </ul>
        </section>
      ) : null}

      {screen === "choose" && noLists ? (
        <p className="text-body-base-regular text-text-secondary">{LIST_COPY.noLists}</p>
      ) : null}

      {failed ? (
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

      <Alert variant="privacy">{LIST_COPY.privacy}</Alert>

      <div
        ref={actionsRef}
        className={cx(
          "flex flex-col gap-8",
          pinned
            ? "sticky bottom-0 -mx-20 mt-auto bg-surface-default px-20 pb-24 pt-12 md:static md:mx-0 md:p-0"
            : "mt-auto",
        )}
      >
        {screen === "ideas" ? (
          <>
            <Button fullWidth onClick={() => finish(LIST_COPY.toastReady)}>
              {LIST_COPY.done}
            </Button>
            <Button variant="secondary" fullWidth disabled={!online} aria-haspopup="dialog" onClick={() => openItemSheet()}>
              {LIST_COPY.addAnother}
            </Button>
          </>
        ) : screen === "current" ? (
          <>
            <Button variant="secondary" fullWidth disabled={!online} aria-haspopup="dialog" onClick={openPicker}>
              {LIST_COPY.chooseDifferent}
            </Button>
            {/* WHY only with ideas kept: switching back must never leave an empty list in place of the wishlist. */}
            {ideas.items.length > 0 ? (
              <Button variant="secondary" fullWidth busy={busy === "ideas"} disabled={!online} onClick={startIdeas}>
                {LIST_COPY.addItems}
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button
              variant={noLists ? "secondary" : "primary"}
              fullWidth
              disabled={!online || noLists}
              aria-haspopup="dialog"
              onClick={openPicker}
            >
              {LIST_COPY.choose}
            </Button>
            <Button
              variant={noLists ? "primary" : "secondary"}
              fullWidth
              busy={busy === "ideas"}
              disabled={!online}
              aria-haspopup="dialog"
              onClick={startIdeas}
            >
              {LIST_COPY.addItems}
            </Button>
            {toJoined ? (
              <Button variant="text" fullWidth disabled={!online} href={`${exchangePath}/joined`}>
                {LIST_COPY.skip}
              </Button>
            ) : null}
          </>
        )}
      </div>

      <WishlistPickerSheet
        key={`picker-${sessions.picker}`}
        open={picker}
        onClose={() => setPicker(false)}
        timeZone={timeZone}
        currentId={currentWishlistId}
        onUse={(id) => attach(id)}
        onFailed={(id, name) => setFailed({ id, name })}
      />
      <ItemSheet
        key={`item-${sessions.item}`}
        open={itemSheet.open}
        onClose={() => setItemSheet({ open: false })}
        actions={itemActions}
        signedOutNext={ownPath}
        item={itemSheet.item}
        onSaved={onItemSaved}
        description={LIST_COPY.itemSheetNote}
        priceHelper={priceHelper(exchange.budget)}
      />
    </div>
  );
}
