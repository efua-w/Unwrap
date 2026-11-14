import { ListRow } from "@/components/ui/ListRow";
import { yourListSubline } from "@/features/exchange-list/copy";
import { EXCHANGE_COPY } from "../copy";
import type { OwnListSummary } from "../types";

type Props = {
  mode: "participant" | "organiser";
  exchangeId: string;
  list: OwnListSummary;
  /** "Fri 27 Nov", or null when the organiser draws names themselves. */
  drawDay: string | null;
};

// GC-013 / GCO-004 Your part: the viewer's own list row, then the "Who you're buying for" placeholder
// (boards Exchange-Detail-before, -nolist, -oattached, -oideas, -ostarted). The list row goes to /list for
// a participant and /my-list for an organiser (owner Q11). WHY the second row is not a link: nothing is
// drawn yet (slice 10 replaces it).
export function YourPart({ mode, exchangeId, list, drawDay }: Props) {
  const copy = EXCHANGE_COPY.detail;
  const path = mode === "organiser" ? "my-list" : "list";
  return (
    <section aria-labelledby="part-heading" className="flex flex-col gap-4">
      <h2 id="part-heading" className="text-heading-4">
        {copy.yourPart}
      </h2>
      <ul>
        <ListRow title={copy.yourListTitle} sub={yourListSubline(list, mode)} href={`/exchanges/${exchangeId}/${path}`} />
        <ListRow
          title={copy.buyingTitle}
          sub={drawDay ? copy.buyingSub(drawDay) : copy.buyingSubManual}
          divider
        />
      </ul>
    </section>
  );
}
