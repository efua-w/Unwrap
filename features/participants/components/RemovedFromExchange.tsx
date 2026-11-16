import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PARTICIPANTS_COPY } from "../copy";

// GC-029 / owner Q15, board Acc-NA-removed: a person the organiser removed opens the exchange's old link.
// WHY only the name: that is all the database gives back (get_removed_exchange_name), and it gives it to
// the removed person alone. No organiser name, no reason, no people.
export function RemovedFromExchange({ exchangeName }: { exchangeName: string }) {
  const copy = PARTICIPANTS_COPY;
  return (
    <EmptyState
      headingLevel={1}
      title={copy.removedTitle(exchangeName)}
      body={copy.removedBody}
      action={<Button href="/home">{copy.removedAction}</Button>}
    />
  );
}
