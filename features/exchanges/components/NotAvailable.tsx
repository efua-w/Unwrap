import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EXCHANGE_COPY } from "../copy";

// S47 / GC-029: a missing, cancelled, someone else's or not-yet-yours exchange all get this one state,
// which never names the exchange or confirms it exists. Shared by the exchange page and the list pages.
export function NotAvailable() {
  const copy = EXCHANGE_COPY.detail;
  return (
    <EmptyState
      headingLevel={1}
      title={copy.notAvailableTitle}
      body={copy.notAvailableBody}
      action={<Button href="/home">{copy.notAvailableCta}</Button>}
    />
  );
}
