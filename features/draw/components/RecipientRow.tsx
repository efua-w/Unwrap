"use client";

import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { DRAW_COPY } from "../copy";
import { useDeviceHidden } from "../use-device-hidden";
import { useRecipient } from "./RecipientName";

type Props = {
  exchangeId: string;
  assignmentId: string;
  /** From the database: the giver has revealed at least once. Never the name. */
  revealedBefore: boolean;
};

// GC-013 "Who you're buying for" row after the draw (boards Exchange-Detail-drawn, -revealed, -hidden). WHY a client
// component: the person's name is never in server-rendered HTML (AC-12), so a giver who has revealed and has not hidden
// it on this device gets it from the RecipientNameProvider after the page mounts. Until then, and for everyone else, the row
// says "Hidden until you reveal it.". WHY the link: before the reveal it leads to Reveal (the privacy check); once revealed
// it leads to the person's wishlist (slice 11, GC-015), which handles a hidden device itself. A hidden device's "Show" goes
// to Reveal so the check runs again.
export function RecipientRow({ exchangeId, assignmentId, revealedBefore }: Props) {
  const device = useDeviceHidden(assignmentId);
  const { name } = useRecipient();

  const revealHref = `/exchanges/${exchangeId}/reveal`;
  if (revealedBefore && device === "hidden") {
    return (
      <ListRow
        title={DRAW_COPY.hiddenTitle}
        sub={DRAW_COPY.buyingTitle}
        // WHY a sibling target: the row is not a link here, "Show" is, and a link can't sit inside a link.
        action={
          <Button variant="link" href={revealHref}>
            {DRAW_COPY.hiddenShow}
          </Button>
        }
        divider
      />
    );
  }
  const href = revealedBefore ? `/exchanges/${exchangeId}/recipient` : revealHref;
  if (name !== null) {
    return (
      <ListRow
        title={name}
        sub={DRAW_COPY.buyingTitle}
        leading={<Avatar name={name} size="row" decorative />}
        href={href}
        meta={<Icon icon={CaretRight} className="text-text-muted" />}
        divider
      />
    );
  }
  return (
    <ListRow
      title={DRAW_COPY.buyingTitle}
      sub={DRAW_COPY.buyingHidden}
      href={href}
      meta={<Icon icon={CaretRight} className="text-text-muted" />}
      divider
    />
  );
}
