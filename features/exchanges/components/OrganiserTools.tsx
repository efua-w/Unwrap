"use client";

import { useState } from "react";
import { ListRow } from "@/components/ui/ListRow";
import { DRAW_COPY } from "@/features/draw/copy";
import { DrawSheet, type DrawSheetData } from "@/features/draw/components/DrawSheet";
import { EXCLUSIONS_COPY, pairCountLabel } from "@/features/exclusions/copy";
import type { ExclusionsEntry } from "@/features/exclusions/types";
import { EXCHANGE_COPY } from "../copy";
import { InvitePeopleSheet } from "./InvitePeopleSheet";

type Props = {
  exchangeId: string;
  exchangeName: string;
  /** The last day people can join, as the viewer sees it. */
  lastJoinDay: string;
  /** Built on the server. Organiser-only (GCO-004, GCO-005). Null once joining has closed: no Invite people row then. */
  inviteUrl: string | null;
  approvalRequired: boolean;
  /** Names of people waiting for approval (the organiser may read them). */
  waitingNames: readonly string[];
  /** Null when pairs cannot be set (the event has passed or the exchange is complete): no Exclusions row (GCO-009, Q5b). */
  exclusions: ExclusionsEntry | null;
  /** The Draw names now… row and its sheet. Null once names are drawn (or joining state forbids it): only Exclusions remains (owner Q8). */
  draw: { sub: string; sheet: DrawSheetData } | null;
};

// GCO-005 Organiser tools: the Invite people row, which opens the shared sheet (boards
// Exchange-Detail-oattached, Org-Invite-*), the Exclusions row with its pair count (GCO-009, owner Q6) and the Draw names
// now… row with its sheet (GCO-011, board Exchange-Detail-obefore). After the draw only Exclusions is left (owner Q8,
// 2026-11-22); Edit, Hand over and Cancel arrive with slices 13, 14 and 15.
export function OrganiserTools({ exchangeId, exchangeName, lastJoinDay, inviteUrl, approvalRequired, waitingNames, exclusions, draw }: Props) {
  const copy = EXCHANGE_COPY.detail;
  const [open, setOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  return (
    <section aria-labelledby="tools-heading" className="flex flex-col gap-4">
      <h2 id="tools-heading" className="text-heading-4">
        {copy.toolsTitle}
      </h2>
      <ul>
        {inviteUrl ? <ListRow title={copy.toolInvite} sub={copy.toolInviteSub(lastJoinDay)} onClick={() => setOpen(true)} /> : null}
        {exclusions ? (
          <ListRow
            title={EXCLUSIONS_COPY.title}
            sub={exclusions.count === null ? undefined : pairCountLabel(exclusions.count)}
            href={`/exchanges/${exchangeId}/exclusions`}
            divider={inviteUrl !== null}
          />
        ) : null}
        {draw ? (
          <ListRow
            title={DRAW_COPY.rowTitle}
            sub={draw.sub}
            onClick={() => setDrawOpen(true)}
            divider={inviteUrl !== null || exclusions !== null}
          />
        ) : null}
      </ul>
      {draw ? (
        <DrawSheet
          {...draw.sheet}
          open={drawOpen}
          onClose={() => setDrawOpen(false)}
          onInvite={inviteUrl ? () => setOpen(true) : undefined}
        />
      ) : null}
      {inviteUrl ? (
        <InvitePeopleSheet
          open={open}
          onClose={() => setOpen(false)}
          exchangeId={exchangeId}
          exchangeName={exchangeName}
          lastJoinDay={lastJoinDay}
          inviteUrl={inviteUrl}
          approvalRequired={approvalRequired}
          waitingNames={waitingNames}
        />
      ) : null}
    </section>
  );
}
