import { getMyAssignment, getRevealExchange } from "@/features/draw/queries";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { NotAvailable } from "@/features/exchanges/components/NotAvailable";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { formatYmdDay } from "@/lib/dates/format";
import { budgetLabel } from "@/lib/money/budget";
import { RecipientFlow } from "./RecipientFlow";

// GC-015 Recipient's wishlist (S16). Anyone whose current assignment as giver has been revealed, while names are drawn or
// the gift day has passed (the same access as Reveal, plus the reveal itself). Everyone else (an organiser who only
// organises, a requester, an outsider, a giver who has not revealed, a cancelled exchange) gets the same "isn't available"
// as any missing exchange (GC-029). WHY nothing here reads the person: the name, photo and items arrive from a Server
// Action after mount (slice-10 AC-12). This component sends the exchange's own facts and the assignment id, which the
// page's viewer already holds, and nothing else.
export async function RecipientContent({ id }: { id: string }) {
  let loaded;
  try {
    const assignment = await getMyAssignment(id);
    loaded = assignment ? { assignment, exchange: await getRevealExchange(id) } : null;
  } catch {
    return <LoadError>{EXCHANGE_COPY.detail.loadError}</LoadError>;
  }
  if (!loaded || !loaded.assignment.revealed || !loaded.exchange) return <NotAvailable />;
  const { assignment, exchange } = loaded;
  return (
    <RecipientFlow
      exchangeId={id}
      assignmentId={assignment.assignmentId}
      budget={exchange.budget}
      spend={budgetLabel(exchange.budget)}
      giftDay={formatYmdDay(exchange.giftDay) ?? ""}
    />
  );
}
