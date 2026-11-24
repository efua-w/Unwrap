"use client";

import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { useToast } from "@/components/ui/Toast";
import { DRAW_COPY } from "@/features/draw/copy";
import { useDeviceHidden } from "@/features/draw/use-device-hidden";
import { firstName } from "@/features/joining/copy";
import { itemCountLabel, itemSub, WISHLIST_COPY } from "@/features/wishlists/copy";
import { budgetFit, budgetRangePhrase, type BudgetPreset } from "@/lib/money/budget";
import { openRecipientList, setGiftMark } from "../actions";
import { GIFT_COPY } from "../copy";
import { rowBadge, spendWords, type RowBadge } from "../format";
import type { RecipientItem, RecipientList, TakenOffItem } from "../types";
import { GiftItemSheet } from "./GiftItemSheet";

type Props = {
  exchangeId: string;
  assignmentId: string;
  budget: BudgetPreset;
  /** "₦15,000 to ₦25,000", and "Sat 19 Dec": exchange facts, not the person. */
  spend: string;
  giftDay: string;
};

type Load =
  | { status: "loading" }
  | { status: "ready"; list: RecipientList }
  | { status: "error" };

// GC-015 Recipient's wishlist (S16; boards Exchange-Wishlist-default, -loading, -empty, -nolist, -error, -offline, -marked,
// -removed and S17 Exchange-Wishlist-item*). WHY a client component fed by a Server Action: the person's name, photo and items
// must never be in the page's server-rendered HTML (slice-10 AC-12, owner B3), so the server sends only the exchange's facts
// and this component asks for the person after it mounts. WHY it asks nothing while this device has the person hidden (Q3):
// open_recipient_list stamps the open time, and a hidden device has not looked. WHY the mark is pessimistic (the button shows
// busy and the row changes when the database says so): a mark the database refused must never look saved.
export function RecipientFlow({ exchangeId, assignmentId, budget, spend, giftDay }: Props) {
  const copy = GIFT_COPY;
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const { online, reportNetworkError } = useNetworkStatus();
  const device = useDeviceHidden(assignmentId);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  // WHY: the name is only ever known after a successful load, so a later error line can use it and a first one cannot.
  const [knownFirst, setKnownFirst] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  // WHY a ref and not a cancelled flag: one open is one stamp. React's development double effect would otherwise call the
  // action twice, and the second open would clear every Updated badge the first one computed.
  const started = useRef(false);
  const path = `/exchanges/${exchangeId}/recipient`;

  function toLogin() {
    router.replace(`/login?next=${encodeURIComponent(path)}`);
  }

  function fetchList() {
    started.current = true;
    setLoad({ status: "loading" });
    openRecipientList(exchangeId)
      .then((result) => {
        if (result.ok) {
          setKnownFirst(firstName(result.list.displayName));
          setLoad({ status: "ready", list: result.list });
        } else if (result.reason === "signed-out") toLogin();
        else if (result.reason === "unavailable") {
          // WHY refresh and an error line: if the page is no longer available the refresh shows S47; if it is, nothing is lost.
          router.refresh();
          setLoad({ status: "error" });
        } else setLoad({ status: "error" });
      })
      .catch(() => {
        reportNetworkError();
        setLoad({ status: "error" });
      });
  }

  useEffect(() => {
    if (device === "hidden") started.current = false;
    if (device !== "shown" || started.current) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  // WHY in render: Hide again in another tab flips the flag here, and the person must not stay in this page's state or be
  // painted for a frame (same as RevealFlow). The next Show starts a fresh open.
  if (device === "hidden" && load.status !== "loading") setLoad({ status: "loading" });

  const list = load.status === "ready" ? load.list : null;
  const openRef = params.get("item");
  const openItem = list && openRef ? (list.items.find((i) => i.ref === openRef) ?? null) : null;

  // WHY a ref: a row click pushes ?item=, so Close pops that entry and Back never lands on the same list twice. A sheet opened
  // by a direct link or from Reveal has no in-page entry to pop, so it replaces instead (never leaves the app).
  const pushedHere = useRef(false);
  function closeSheet() {
    if (pushedHere.current) {
      pushedHere.current = false;
      router.back();
      return;
    }
    router.replace(path, { scroll: false });
  }

  // R1-5: a ?item= that matches no item or taken-off entry (removed since Reveal) says so once and clears the query.
  const goneRef = useRef<string | null>(null);
  const known = list ? list.items.some((i) => i.ref === openRef) || list.takenOff.some((t) => t.ref === openRef) : true;
  useEffect(() => {
    if (!openRef || known || goneRef.current === openRef) return;
    goneRef.current = openRef;
    pushedHere.current = false;
    toast.show({ message: copy.itemGone });
    router.replace(path, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRef, known]);

  function patchItem(ref: string, got: boolean) {
    setLoad((current) =>
      current.status === "ready"
        ? { ...current, list: { ...current.list, items: current.list.items.map((i) => (i.ref === ref ? { ...i, got } : i)) } }
        : current,
    );
  }

  // One mark call for the sheet, the taken-off note and the toast's Undo. Returns whether the database accepted it.
  async function mark(ref: string, got: boolean): Promise<boolean> {
    try {
      const result = await setGiftMark(exchangeId, ref, got);
      if (result.ok) return true;
      if (result.reason === "signed-out") toLogin();
      else if (result.reason === "not-found") {
        // WHY: the item left the list, or the exchange closed, since this page loaded. Read the list again; never say why.
        toast.show({ message: copy.itemGone });
        fetchList();
      } else toast.show({ message: WISHLIST_COPY.saveFailed });
    } catch {
      reportNetworkError();
      toast.show({ message: WISHLIST_COPY.saveFailed });
    }
    return false;
  }

  async function markItem(item: RecipientItem, got: boolean) {
    if (marking || !online) return;
    setMarking(true);
    const ok = await mark(item.ref, got);
    setMarking(false);
    if (!ok) return;
    patchItem(item.ref, got);
    closeSheet();
    toast.show({
      message: got ? copy.marked(item.name) : copy.unmarked(item.name),
      action: got ? { label: WISHLIST_COPY.undo, onAction: () => void undoMark(item) } : undefined,
    });
  }

  async function undoMark(item: RecipientItem) {
    if (!(await mark(item.ref, false))) return;
    patchItem(item.ref, false);
  }

  async function unmarkTakenOff(entry: TakenOffItem) {
    if (marking || !online) return;
    setMarking(true);
    const ok = await mark(entry.ref, false);
    setMarking(false);
    if (!ok) return;
    setLoad((current) =>
      current.status === "ready"
        ? { ...current, list: { ...current.list, takenOff: current.list.takenOff.filter((t) => t.ref !== entry.ref) } }
        : current,
    );
    toast.show({ message: copy.unmarked(entry.name) });
  }

  const column = "flex flex-col gap-32 md:max-w-reading-max";

  if (device === "hidden") {
    return (
      <div className={column}>
        <EmptyState
          headingLevel={1}
          title={DRAW_COPY.hiddenTitle}
          body={copy.hiddenBody}
          // WHY /reveal (owner B4): Show runs the privacy check again before the name appears.
          action={<Button href={`/exchanges/${exchangeId}/reveal`}>{DRAW_COPY.hiddenShow}</Button>}
        />
      </div>
    );
  }

  // WHY the same h1 in every state: focus and the screen reader's place survive the load, and until the name is known
  // the heading is the neutral one (owner B3).
  const heading = (name: string | null) => (
    <h1 className="break-words text-heading-2 md:text-heading-1">{name ? copy.title(name) : copy.loadingTitle}</h1>
  );

  if (load.status === "loading") {
    return (
      <div className={column}>
        <header className="flex flex-col gap-8">{heading(null)}</header>
        <SkeletonRegion>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} shape="row" />
          ))}
        </SkeletonRegion>
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className={column}>
        <header className="flex flex-col gap-8">{heading(knownFirst)}</header>
        <Alert
          variant="error"
          action={
            <Button variant="link" disabled={!online} onClick={fetchList}>
              {copy.tryAgain}
            </Button>
          }
        >
          {knownFirst ? copy.loadError(knownFirst) : copy.loadErrorNeutral}
        </Alert>
      </div>
    );
  }

  const { list: loaded } = load;
  const name = firstName(loaded.displayName);

  return (
    <div className={column}>
      <header className="flex flex-col gap-8">
        {heading(name)}
        <p className="text-body-base-regular text-text-secondary">{copy.intro(loaded.displayName, spendWords(spend), giftDay)}</p>
      </header>

      {loaded.takenOff.length > 0 ? (
        <div className="flex flex-col gap-12 rounded-xl bg-surface-subtle px-16 py-12">
          {loaded.takenOff.map((entry) => (
            <div key={entry.ref} className="flex flex-col items-start gap-4">
              <p className="break-words text-body-sm-regular text-text-default">
                {loaded.listState === "none" ? copy.takenOffList(name, entry.name) : copy.takenOff(name, entry.name)}
              </p>
              <Button
                variant="link"
                disabled={!online || marking}
                onClick={() => void unmarkTakenOff(entry)}
                aria-label={copy.unmarkLabel(entry.name)}
              >
                {copy.unmark}
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {loaded.listState === "none" ? (
        <EmptyState title={copy.noListTitle(name)} body={copy.noListBody} />
      ) : loaded.items.length === 0 ? (
        <EmptyState title={copy.emptyTitle} body={copy.emptyBody(giftDay, name)} />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-16 text-body-sm-regular text-text-muted">
            <p>{itemCountLabel(loaded.items.length)}</p>
            <p>{copy.recentFirst}</p>
          </div>
          <ul
            onClickCapture={(e) => {
              // A plain click on a row link pushes a history entry; a modified click opens elsewhere.
              if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && (e.target as Element).closest("a")) {
                pushedHere.current = true;
              }
            }}
          >
            {loaded.items.map((item, i) => (
              <ListRow
                key={item.ref}
                title={item.name}
                sub={itemSub(item)}
                href={`${path}?item=${item.ref}`}
                meta={<RowMeta badge={rowBadge(item, budgetFit(budget, item.priceKobo))} />}
                divider={i > 0}
              />
            ))}
          </ul>
          {/* WHY hidden offline: board Exchange-Wishlist-offline shows the list with no hint line. */}
          {online ? <p className="text-body-sm-regular text-text-muted">{copy.hint(name)}</p> : null}
        </>
      )}

      <GiftItemSheet
        item={openItem}
        fit={openItem ? budgetFit(budget, openItem.priceKobo) : null}
        range={budgetRangePhrase(budget)}
        first={name}
        online={online}
        busy={marking}
        onClose={closeSheet}
        onMark={(item, got) => void markItem(item, got)}
      />
    </div>
  );
}

// WHY the badge carries its meaning in text, never colour alone (CLAUDE.md UI rules); the chevron shows when nothing applies.
function RowMeta({ badge }: { badge: RowBadge | null }) {
  if (badge === "got") return <Chip variant="date">{GIFT_COPY.gotThis}</Chip>;
  if (badge === "over") return <Chip variant="urgent">{GIFT_COPY.overBudget}</Chip>;
  if (badge === "updated") return <Chip variant="date">{GIFT_COPY.updated}</Chip>;
  return <Icon icon={CaretRight} className="text-text-muted" />;
}
