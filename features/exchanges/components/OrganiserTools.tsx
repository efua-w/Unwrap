"use client";

import { useState } from "react";
import { ListRow } from "@/components/ui/ListRow";
import { EXCHANGE_COPY } from "../copy";
import { InvitePeopleSheet } from "./InvitePeopleSheet";

type Props = {
  exchangeId: string;
  exchangeName: string;
  /** The last day people can join, as the viewer sees it. */
  lastJoinDay: string;
  /** Built on the server. Organiser-only (GCO-004, GCO-005). */
  inviteUrl: string;
  approvalRequired: boolean;
  /** Names of people waiting for approval (the organiser may read them). */
  waitingNames: readonly string[];
};

// GCO-005 Organiser tools: the Invite people row, which opens the shared sheet (boards
// Exchange-Detail-oattached, Org-Invite-*). Edit, Draw, Exclusions, Hand over and Cancel arrive with slices
// 9, 10, 13, 14 and 15.
export function OrganiserTools({ exchangeId, exchangeName, lastJoinDay, inviteUrl, approvalRequired, waitingNames }: Props) {
  const copy = EXCHANGE_COPY.detail;
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="tools-heading" className="flex flex-col gap-4">
      <h2 id="tools-heading" className="text-heading-4">
        {copy.toolsTitle}
      </h2>
      <ul>
        <ListRow title={copy.toolInvite} sub={copy.toolInviteSub(lastJoinDay)} onClick={() => setOpen(true)} />
      </ul>
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
    </section>
  );
}
