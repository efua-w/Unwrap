"use client";

import { useState } from "react";
import { ListRow } from "@/components/ui/ListRow";
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
};

// GCO-005 Organiser tools: the Invite people row, which opens the shared sheet (boards
// Exchange-Detail-oattached, Org-Invite-*) and the Exclusions row with its pair count (GCO-009, owner Q6). Edit, Draw,
// Hand over and Cancel arrive with slices 10, 13, 14 and 15.
export function OrganiserTools({ exchangeId, exchangeName, lastJoinDay, inviteUrl, approvalRequired, waitingNames, exclusions }: Props) {
  const copy = EXCHANGE_COPY.detail;
  const [open, setOpen] = useState(false);
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
      </ul>
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
