import { Button } from "@/components/ui/Button";
import { ExchangeTag, type ExchangeTint } from "@/components/ui/ExchangeTag";
import { firstName } from "@/features/joining/copy";
import { REQUEST_BLOCK_COPY } from "../copy";
import { waitingNames } from "../format";
import { BlockCard } from "./BlockCard";

type Props = {
  exchangeId: string;
  /** Names of the people waiting, oldest first. At least one. */
  names: readonly string[];
  /** The last day people can join, as the viewer sees it. */
  lastJoinDay: string;
  /** False once the join-by day has passed: the "until" sentence becomes "closed on". */
  joiningOpen: boolean;
  /** Set on Exchanges, where the block names its exchange; absent on the exchange's own page. */
  exchange?: { name: string; tint: ExchangeTint };
};

// GCO-006 "Needs you now" request block (board Exchange-Detail-obefore; the one on Exchanges follows the
// "Only you so far" block's frame). One person: their name; several: the count and the first names. The
// action goes to Participants, where Approve and Decline live (AC-10). WHY names only: the organiser never
// reads an email, and the block carries no ids beyond the exchange's own.
export function JoinRequestBlock({ exchangeId, names, lastJoinDay, joiningOpen, exchange }: Props) {
  const copy = REQUEST_BLOCK_COPY;
  const count = names.length;
  const headingId = `requests-${exchangeId}`;
  const [only] = names;
  const single = count === 1 && only !== undefined;
  const title = single ? copy.one(only) : copy.many(count);
  const body = single
    ? (joiningOpen ? copy.oneBody : copy.oneBodyClosed)(firstName(only), lastJoinDay)
    : (joiningOpen ? copy.manyBody : copy.manyBodyClosed)(waitingNames(names), lastJoinDay);
  return (
    <BlockCard
      headingId={headingId}
      header={
        exchange ? (
          <div className="flex items-center gap-12">
            <ExchangeTag name={exchange.name} tint={exchange.tint} />
            <div className="flex min-w-0 flex-col">
              <span className="break-words text-body-base-semibold">{exchange.name}</span>
              <span className="text-body-sm-regular text-text-muted">{copy.meta}</span>
            </div>
          </div>
        ) : undefined
      }
      meta={exchange ? undefined : copy.meta}
      title={title}
      body={body}
      action={
        <Button variant="secondary" href={`/exchanges/${exchangeId}/participants`}>
          {single ? copy.reviewOne : copy.reviewMany(count)}
        </Button>
      }
    />
  );
}
