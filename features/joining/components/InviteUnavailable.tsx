import { Button } from "@/components/ui/Button";
import { formatDay } from "@/lib/dates/format";
import { REQUEST_COPY, UNAVAILABLE_COPY, firstName, unavailableBody } from "../copy";
import type { InvitePreview, UnavailableKind } from "../types";
import { InviteActions } from "./InviteActions";
import { InviteFrame } from "./InviteFrame";

// S13 Invite unavailable (GC-012). Boards: Joining-Unavailable-incorrect, -closed, -cancelled (m, d).
// WHY the facts come from the public preview and not the join view: it already holds exactly the
// organiser's name, the exchange name and the moment joining closed or the exchange was cancelled,
// and nothing about who is in (GC-002). The closed state with a request allowed is AskToJoin; this one
// has the single action Go to Unwrap.
export function InviteUnavailable({
  kind,
  preview,
  signedIn,
  timeZone,
  askToken,
}: {
  kind: UnavailableKind;
  preview: InvitePreview | null;
  signedIn: boolean;
  timeZone: string;
  /** Set for a signed-out visitor when joining closed and a request is allowed (GC-012): adds the board's second line and Ask to join. */
  askToken?: string;
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
        askToken ? (
          <InviteActions token={askToken} ask />
        ) : (
          <Button fullWidth href={signedIn ? "/home" : "/"}>
            {UNAVAILABLE_COPY.goToUnwrap}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-8">
        <h1 className="text-heading-1">{UNAVAILABLE_COPY.title}</h1>
        <p className="break-words text-body-base-regular text-text-secondary">{body}</p>
        {askToken && preview ? (
          <p className="break-words text-body-base-regular text-text-secondary">{REQUEST_COPY.stillAsk(firstName(preview.inviterName))}</p>
        ) : null}
      </div>
    </InviteFrame>
  );
}
