"use client";

import { Gift } from "@phosphor-icons/react/dist/ssr";
import { ActionCard, type ActionCardPlacement } from "@/components/ui/ActionCard";
import { Button } from "@/components/ui/Button";
import { DRAW_COPY } from "@/features/draw/copy";
import { useRecipient } from "@/features/draw/components/RecipientName";
import { useDeviceHidden } from "@/features/draw/use-device-hidden";
import { firstName } from "@/features/joining/copy";
import { GIFT_COPY } from "../copy";
import { spendWords } from "../format";

type Props = {
  exchangeId: string;
  assignmentId: string;
  placement: ActionCardPlacement;
  /** "₦15,000 to ₦25,000" and "Sat 19 Dec": the exchange's own facts, safe in the server HTML. */
  spend: string;
  giftDay: string;
};

// GC-015 / S14 revealed ActionCard (board Exchange-Detail-revealed: "You're buying for Kemi." / "Spend ... Gifts are exchanged
// on ..." / "View their wishlist", dismiss="false"). WHY NOT dismissible (owner B1): the board has no control, so there is
// none. WHY a client component: the title names the person, who is never in server-rendered HTML (slice-10 AC-12). The
// person arrives through RecipientNameProvider, and a device that hid them gets no card. WHY an invisible card while the
// name loads: it holds its space, so the page does not jump, and it is out of the focus order and the accessibility tree.
// Both placements are rendered by the caller (banner first in the DOM, tray last), as for the other cards.
export function RevealedCard({ exchangeId, assignmentId, placement, spend, giftDay }: Props) {
  const { name, failed } = useRecipient();
  const device = useDeviceHidden(assignmentId);
  // WHY nothing for a device that hid the person, or a read that failed: no card, and no empty gap either (board Exchange-Detail-hidden has none).
  if (device === "hidden" || failed) return null;
  const card = (
    <ActionCard
      label={DRAW_COPY.needsYou}
      placement={placement}
      icon={Gift}
      title={name ? GIFT_COPY.cardTitle(firstName(name)) : GIFT_COPY.cardTitleLoading}
      sub={GIFT_COPY.cardSub(spendWords(spend), giftDay)}
      action={
        <Button href={`/exchanges/${exchangeId}/recipient`} fullWidth className="md:w-auto">
          {DRAW_COPY.viewList}
        </Button>
      }
    />
  );
  if (name === null) return <div aria-hidden="true" className="contents invisible">{card}</div>;
  return card;
}
