import { Button } from "@/components/ui/Button";
import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { EXCHANGE_COPY } from "../copy";
import { blockBody } from "../timeline";
import type { ExchangeListItem } from "../types";

// S08 organiser block "Only you so far" (GCO-004 B): the invite link is the next job. Its action goes
// to the exchange page's invite section. "Add your wishlist" joins it in slice 5 (owner decision 5).
export function ExchangeBlock({ item, timeZone }: { item: ExchangeListItem; timeZone: string }) {
  const copy = EXCHANGE_COPY.list;
  return (
    <section aria-labelledby={`block-${item.id}`} className="flex flex-col gap-12 rounded-2xl bg-surface-subtle p-20">
      <div className="flex items-center gap-12">
        <ExchangeTag name={item.name} tint={item.tint} />
        <div className="flex min-w-0 flex-col">
          <span className="break-words text-body-base-semibold">{item.name}</span>
          <span className="text-body-sm-regular text-text-muted">{copy.blockMeta}</span>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h2 id={`block-${item.id}`} className="text-heading-4">
          {copy.blockHeadline}
        </h2>
        <p className="text-body-sm-regular text-text-secondary">{blockBody(item, timeZone)}</p>
      </div>
      <div className="flex flex-col md:items-start">
        <Button href={`/exchanges/${item.id}#invite`} fullWidth className="md:w-auto">
          {copy.blockAction}
        </Button>
      </div>
    </section>
  );
}
