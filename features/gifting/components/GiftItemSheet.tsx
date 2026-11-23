"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { PRIORITY_LABEL } from "@/features/wishlists/copy";
import type { BudgetFit } from "@/lib/money/budget";
import { formatNaira } from "@/lib/money/naira";
import { GIFT_COPY } from "../copy";
import type { RecipientItem } from "../types";

type Props = {
  /** The item the URL names, or null when none is open. */
  item: RecipientItem | null;
  fit: BudgetFit | null;
  /** "₦15,000 to ₦25,000". */
  range: string;
  first: string;
  online: boolean;
  /** A mark is being saved. */
  busy: boolean;
  onClose: () => void;
  onMark: (item: RecipientItem, got: boolean) => void;
};

// S17 Item detail (boards Exchange-Wishlist-item, -itemgot, -itembusy, -itemoffline, -nolink, -copied): a bottom sheet below
// 768 and a centred dialog from 768, on the shared native <dialog> Sheet (scrim, Escape, focus trap). WHY the page's list
// stays under it: the URL's ?item= opens it, so Back closes it. WHY the shop link and Copy link stay on when offline: they
// need no connection from us (board itemoffline); only marking does. WHY "Open the shop" is a button that opens a new tab:
// the shared Button has no external-link form, and ShareActions opens WhatsApp the same way. The link was parsed as http or
// https, and noopener keeps the shop from reaching this page.
export function GiftItemSheet({ item, fit, range, first, online, busy, onClose, onMark }: Props) {
  const toast = useToast();
  const copy = GIFT_COPY;

  async function copyLink() {
    if (!item?.link) return;
    try {
      await navigator.clipboard.writeText(item.link);
      toast.show({ message: copy.copied });
    } catch {
      toast.show({ message: copy.copyFailed });
    }
  }

  const meta = item
    ? [item.priceKobo === null ? null : formatNaira(item.priceKobo), PRIORITY_LABEL[item.priority], item.got ? copy.gotThis : null]
        .filter((part): part is string => part !== null)
        .join(" · ")
    : "";

  const markButton = item ? (
    <Button
      variant={item.link ? "secondary" : "primary"}
      fullWidth
      busy={busy}
      disabled={!online}
      onClick={() => onMark(item, !item.got)}
    >
      {item.got ? copy.notGot : copy.iGotThis}
    </Button>
  ) : null;

  const link = item?.link ?? null;
  const footer = item ? (
    link ? (
      <>
        <Button fullWidth onClick={() => window.open(link, "_blank", "noopener,noreferrer")}>
          {copy.openShop}
        </Button>
        {markButton}
        <Button variant="text" fullWidth onClick={() => void copyLink()}>
          {copy.copyLink}
        </Button>
      </>
    ) : (
      <>
        {markButton}
        <Button variant="text" fullWidth onClick={onClose} disabled={busy}>
          {copy.close}
        </Button>
      </>
    )
  ) : null;

  return (
    <Sheet open={item !== null} onClose={onClose} variant="confirm" title={item?.name ?? ""} busy={busy} footer={footer}>
      {item ? (
        <>
          <p className="text-body-base-regular text-text-secondary">{meta}</p>
          {online ? (
            fit ? (
              <p className="rounded-xl bg-surface-subtle px-16 py-12 text-body-sm-regular text-text-default">
                {copy.budgetNote(fit, range)}
              </p>
            ) : null
          ) : (
            <p className="rounded-xl bg-surface-subtle px-16 py-12 text-body-sm-regular text-text-default">{copy.offlineSheet}</p>
          )}
          {item.note ? <p className="break-words text-body-base-regular text-text-default">{copy.quoted(item.note)}</p> : null}
          {link ? null : <p className="text-body-base-regular text-text-secondary">{copy.noLink}</p>}
          <Alert variant="privacy">{copy.hint(first)}</Alert>
        </>
      ) : null}
    </Sheet>
  );
}
