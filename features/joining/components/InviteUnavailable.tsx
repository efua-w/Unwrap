import { Button } from "@/components/ui/Button";
import { formatDay } from "@/lib/dates/format";
import { UNAVAILABLE_COPY, unavailableBody } from "../copy";
import type { InvitePreview, UnavailableKind } from "../types";
import { InviteFrame } from "./InviteFrame";

// S13 Invite unavailable (GC-012). Boards: Joining-Unavailable-incorrect, -closed, -cancelled (m, d).
// WHY the facts come from the public preview and not the join view: it already holds exactly the
// organiser's name, the exchange name and the moment joining closed or the exchange was cancelled,
// and nothing about who is in (GC-002). "Ask to join" is slice 6, so the board's second closed line and
// its button are not here; the one action is Go to Unwrap.
export function InviteUnavailable({
  kind,
  preview,
  signedIn,
  timeZone,
}: {
  kind: UnavailableKind;
  preview: InvitePreview | null;
  signedIn: boolean;
  timeZone: string;
}) {
  const moment = kind === "cancelled" ? preview?.cancelledAt : kind === "closed" ? preview?.closedAt : null;
  const body = unavailableBody(kind, {
    who: preview?.inviterName ?? null,
    exchangeName: preview?.exchangeName ?? null,
    day: moment ? formatDay(new Date(moment), timeZone) : null,
  });
  return (
    <InviteFrame
      footer={
        <Button fullWidth href={signedIn ? "/home" : "/"}>
          {UNAVAILABLE_COPY.goToUnwrap}
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        <h1 className="text-heading-1">{UNAVAILABLE_COPY.title}</h1>
        <p className="break-words text-body-base-regular text-text-secondary">{body}</p>
      </div>
    </InviteFrame>
  );
}
