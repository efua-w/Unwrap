"use client";

import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { loadRecipient } from "../actions";
import { DRAW_COPY } from "../copy";
import { useDeviceHidden } from "../use-device-hidden";

type Props = {
  exchangeId: string;
  assignmentId: string;
  /** From the database: the giver has revealed at least once. Never the name. */
  revealedBefore: boolean;
};

// GC-013 "Who you're buying for" row after the draw (boards Exchange-Detail-drawn, -revealed, -hidden). WHY a client
// component: the person's name is never in server-rendered HTML (AC-12), so a giver who has revealed and has not hidden
// it on this device gets it from a Server Action after the page mounts. Until then, and for everyone else, the row says
// "Hidden until you reveal it." and leads to Reveal. The row goes to /reveal in every state (owner Q7: the recipient's
// list arrives with slice 11).
export function RecipientRow({ exchangeId, assignmentId, revealedBefore }: Props) {
  const device = useDeviceHidden(assignmentId);
  const [name, setName] = useState<string | null>(null);
  const load = revealedBefore && device === "shown";

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    loadRecipient(exchangeId)
      .then((result) => {
        if (!cancelled && result.ok) setName(result.recipient.displayName);
      })
      .catch(() => {
        // WHY nothing: the row stays in its safe state, and Reveal can try again.
      });
    return () => {
      cancelled = true;
    };
  }, [load, exchangeId]);

  const href = `/exchanges/${exchangeId}/reveal`;
  if (revealedBefore && device === "hidden") {
    return (
      <ListRow
        title={DRAW_COPY.hiddenTitle}
        sub={DRAW_COPY.buyingTitle}
        // WHY a sibling target: the row is not a link here, "Show" is, and a link can't sit inside a link.
        action={
          <Button variant="link" href={href}>
            {DRAW_COPY.hiddenShow}
          </Button>
        }
        divider
      />
    );
  }
  if (load && name !== null) {
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
