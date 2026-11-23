import { LoadError } from "@/features/exchanges/components/LoadError";
import { NotAvailable } from "@/features/exchanges/components/NotAvailable";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { InviteFrame } from "@/features/joining/components/InviteFrame";
import { formatYmdDay, zoneShortName } from "@/lib/dates/format";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";
import { budgetLabel } from "@/lib/money/budget";
import { DRAW_COPY } from "../copy";
import { getMyAssignment, getRevealExchange } from "../queries";
import { RevealFlow } from "./RevealFlow";

// GC-014 Reveal (S15; boards Exchange-Reveal-*). Anyone with a current assignment as giver, while names are drawn or the
// gift day has passed (owner Q10). Everyone else (an organiser who only organises, a requester, an outsider, a cancelled
// exchange) gets the same "isn't available" as any missing exchange (GC-029). WHY nothing here reads the person: the
// recipient's name is fetched by RevealFlow, from a Server Action, after the giver taps (AC-12). This component sends it
// the exchange facts and two flags.
export async function RevealContent({ id }: { id: string }) {
  const close = { href: `/exchanges/${id}`, label: DRAW_COPY.closeLabel };
  let loaded;
  try {
    const assignment = await getMyAssignment(id);
    loaded = assignment ? { assignment, exchange: await getRevealExchange(id) } : null;
  } catch {
    return (
      <InviteFrame close={close}>
        <LoadError>{EXCHANGE_COPY.detail.loadError}</LoadError>
      </InviteFrame>
    );
  }
  if (!loaded || !loaded.exchange) {
    return (
      <InviteFrame>
        <NotAvailable />
      </InviteFrame>
    );
  }
  const { assignment, exchange } = loaded;
  const timeZone = await readViewerTimeZone();
  return (
    <RevealFlow
      exchangeId={id}
      exchangeName={exchange.name}
      assignmentId={assignment.assignmentId}
      revealedBefore={assignment.revealed}
      spend={budgetLabel(exchange.budget)}
      giftDay={formatYmdDay(exchange.giftDay) ?? ""}
      zoneLine={DRAW_COPY.zoneLine(zoneShortName(new Date(), timeZone))}
      closeHref={`/exchanges/${id}`}
    />
  );
}
