import { Avatar } from "@/components/ui/Avatar";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { NotAvailable } from "@/features/exchanges/components/NotAvailable";
import { getOrganiserExchange } from "@/features/exchanges/queries";
import { getParticipants } from "@/features/participants/queries";
import { EXCLUSIONS_COPY } from "../copy";
import { toArrays } from "../draft";
import { checkExclusions, getExclusions } from "../queries";
import type { DraftPair, PairablePerson, PairCheck } from "../types";
import { ExclusionsView } from "./ExclusionsView";

function Heading({ sub }: { sub?: string }) {
  return (
    <header className="flex flex-col gap-8">
      <h1 id="exclusions-heading" tabIndex={-1} className="text-heading-1 focus:outline-none md:text-heading-2">
        {EXCLUSIONS_COPY.title}
      </h1>
      {sub ? <p className="break-words text-body-base-regular text-text-secondary">{sub}</p> : null}
    </header>
  );
}

export function ExclusionsLoading() {
  return (
    <SkeletonRegion>
      <Heading />
      <Skeleton shape="line" text="base" className="w-2/3" />
      <Skeleton shape="row" />
      <Skeleton shape="row" />
    </SkeletonRegion>
  );
}

// Board Org-Excl-locked: the saved pairs with no controls, once names are drawn. Goes live with slice 10, when the
// exchange can reach "drawn". WHY it still reads the pairs: they say what the draw respected, and say nothing about who drew whom.
function LockedPairs({ pairs }: { pairs: readonly DraftPair[] }) {
  const copy = EXCLUSIONS_COPY;
  return (
    <div className="flex flex-col gap-16">
      {pairs.length === 0 ? (
        <p className="text-body-sm-regular text-text-muted">{copy.lockedEmpty}</p>
      ) : (
        <ul aria-label={copy.listLabel}>
          {pairs.map((pair, index) => (
            <ListRow
              key={`${pair.firstId}|${pair.secondId}`}
              title={copy.pairLine(pair.firstName, pair.secondName)}
              sub={copy.lockedPairSub}
              leading={
                <span className="flex shrink-0 items-center">
                  <Avatar name={pair.firstName} size="row" decorative />
                  <Avatar name={pair.secondName} size="row" decorative className="-ml-6" />
                </span>
              }
              divider={index > 0}
            />
          ))}
        </ul>
      )}
      {/* Board Org-Excl-locked-m: the locked line is a plain paragraph, no icon. */}
      <p className="text-body-base-regular text-text-secondary">{copy.lockedBody}</p>
    </div>
  );
}

// S33 Exclusions (GCO-009). WHY the organiser guard is getOrganiserExchange: it answers null for a missing, cancelled,
// someone else's or member-only exchange alike, so every non-organiser gets the same S47 page and learns nothing. The
// database enforces it again in each function this page calls (they answer nobody else). Owner decisions Q5b: once the
// event has passed or the exchange is complete the page is "not available".
export async function ExclusionsContent({ id, viewerId }: { id: string; viewerId: string }) {
  const copy = EXCLUSIONS_COPY;
  let detail;
  try {
    detail = await getOrganiserExchange(id, viewerId);
  } catch {
    return (
      <div className="flex flex-col gap-24 md:max-w-reading-max">
        <Heading />
        <LoadError>{copy.loadErrorUnnamed}</LoadError>
      </div>
    );
  }
  if (!detail) return <NotAvailable />;
  const { exchange } = detail;
  if (exchange.state !== "open" && exchange.state !== "joining_closed" && exchange.state !== "drawn") return <NotAvailable />;

  // WHY the reads end before any JSX: a failure of either answers with the load error, and the render below cannot throw
  // into this catch.
  let pairs: DraftPair[];
  let people: PairablePerson[] = [];
  let check: PairCheck | null = null;
  try {
    pairs = await getExclusions(id);
    if (exchange.state !== "drawn") {
      // WHY mapped here: the address goes to the picker's hint and nowhere else (owner decision Q1a, 2026-11-22).
      people = (await getParticipants(id)).map((p) => ({ memberId: p.memberId, name: p.name, email: p.email }));
      const { first, second } = toArrays(pairs);
      // WHY its own catch: the line is an extra. If it cannot be judged the pairs still show, with no line (owner Q9).
      check = await checkExclusions(id, first, second).catch(() => null);
    }
  } catch {
    return (
      <div className="flex flex-col gap-24 md:max-w-reading-max">
        <Heading sub={exchange.name} />
        <LoadError>{copy.loadError(exchange.name)}</LoadError>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-24 md:max-w-reading-max">
      <Heading sub={exchange.name} />
      {exchange.state === "drawn" ? (
        <LockedPairs pairs={pairs} />
      ) : (
        <ExclusionsView exchangeId={exchange.id} people={people} savedPairs={pairs} initialCheck={check} />
      )}
    </div>
  );
}
