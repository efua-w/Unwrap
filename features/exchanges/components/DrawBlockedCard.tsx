import { Button } from "@/components/ui/Button";
import { DRAW_COPY } from "@/features/draw/copy";
import { blockedFewBody } from "@/features/draw/format";
import type { DrawBlockReason } from "@/features/draw/types";

type Props = {
  exchangeId: string;
  reason: DrawBlockReason;
  /** People taking part, the organiser included when they take part. Decides "how many more" for the few cause. */
  peopleIn: number;
};

// Board Exchange-Detail-ofailed (m, d), UwCard block without a header (GCO-011): the scheduled draw tried once and could not run.
// Organiser-only: the page asks for the reason through get_draw_blocked_reason, which answers nobody else, so no member ever
// renders this. Owner B1: "Draw names now…" stays in Organiser tools, and the board's "We'll try again then" is left out,
// because nothing tries again until slice 13. Owner B2: the exclusions cause is the same card with Edit exclusions.
// The few cause has no action: changing the join-by date is slice 13.
export function DrawBlockedCard({ exchangeId, reason, peopleIn }: Props) {
  const copy = DRAW_COPY.blocked;
  return (
    <section aria-labelledby="blocked-heading" className="flex flex-col gap-12 rounded-2xl bg-surface-subtle p-24">
      <span className="text-body-sm-semibold text-text-muted">{copy.meta}</span>
      <h2 id="blocked-heading" className="text-heading-4">
        {copy.title}
      </h2>
      <p className="text-body-sm-regular text-text-secondary md:text-body-base-regular">
        {reason === "few" ? blockedFewBody(peopleIn) : copy.exclusionsBody}
      </p>
      {reason === "exclusions" ? (
        <div className="flex flex-col md:items-start">
          <Button href={`/exchanges/${exchangeId}/exclusions`} fullWidth className="md:w-auto">
            {copy.editExclusions}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
