import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { ListRow } from "@/components/ui/ListRow";
import { Timeline } from "@/components/ui/Timeline";
import { NotAvailable } from "@/features/exchanges/components/NotAvailable";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { lastJoinDay } from "@/features/exchanges/timeline";
import { zoneShortName } from "@/lib/dates/format";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";
import { JOINED_COPY, joinedLine, joinedSteps, listStatus } from "../joined";
import { LIST_COPY } from "../copy";
import { getExchangeForList, getMyExchangeList } from "../queries";
import { InviteFrame } from "@/features/joining/components/InviteFrame";

// GC-011 / S12 You're in. Boards: Joining-In-attached, -ideas, -skipped, -noreminders (m, d), without the
// "How we'll tell you" section and Share (owner decisions Q7, Q8, 2026-11-13). Members who take part
// only; an organiser, a non-member and a drawn or cancelled exchange all get "isn't available" (GC-029).
// WHY the frame wraps every state: the page is standalone (wordmark and ×), so even the refusal sits in it.
export async function JoinedContent({ id, viewerId }: { id: string; viewerId: string }) {
  const close = { href: `/exchanges/${id}`, label: JOINED_COPY.close };
  let loaded;
  try {
    const exchange = await getExchangeForList(id, viewerId);
    loaded = exchange ? { exchange, myList: await getMyExchangeList(id) } : null;
  } catch {
    return (
      <InviteFrame close={close}>
        <LoadError>{LIST_COPY.loadError}</LoadError>
      </InviteFrame>
    );
  }
  if (!loaded || !loaded.exchange.takingPart || loaded.exchange.isOrganiser) {
    return (
      <InviteFrame>
        <NotAvailable />
      </InviteFrame>
    );
  }
  const { exchange, myList } = loaded;
  if (!myList) {
    return (
      <InviteFrame close={close}>
        <LoadError>{LIST_COPY.loadError}</LoadError>
      </InviteFrame>
    );
  }

  const timeZone = await readViewerTimeZone();
  const status = listStatus(myList, lastJoinDay(exchange, timeZone));
  const exchangePath = `/exchanges/${exchange.id}`;
  return (
    <InviteFrame
      close={close}
      footer={
        <Button href={exchangePath} fullWidth>
          {JOINED_COPY.goToExchange}
        </Button>
      }
    >
      <ExchangeTag name={exchange.name} tint={exchange.tint} size="header" />
      <header className="flex flex-col gap-8">
        <h1 className="text-heading-2">{JOINED_COPY.title}</h1>
        <p className="break-words text-body-base-regular text-text-secondary">{joinedLine(exchange.name)}</p>
      </header>

      <section aria-labelledby="next-heading" className="flex flex-col gap-20 rounded-2xl bg-surface-subtle p-24">
        <h2 id="next-heading" className="text-heading-4">
          {JOINED_COPY.next}
        </h2>
        <Timeline steps={joinedSteps(exchange, timeZone)} />
        <p className="text-body-sm-regular text-text-muted">
          {JOINED_COPY.zoneLine(zoneShortName(new Date(exchange.drawAt ?? exchange.joinByAt), timeZone))}
        </p>
      </section>

      <section aria-labelledby="list-heading" className="flex flex-col gap-4">
        <h2 id="list-heading" className="text-body-base-semibold text-text-default">
          {JOINED_COPY.listHeading}
        </h2>
        <ul>
          {status.missing ? (
            <ListRow title={status.title} sub={status.sub} />
          ) : (
            <ListRow title={status.title} sub={status.sub} href={`${exchangePath}/list`} />
          )}
        </ul>
        {status.below ? <p className="text-body-sm-regular text-text-muted">{status.below}</p> : null}
        {status.missing ? (
          <div className="mt-8 flex">
            <Button variant="secondary" icon={Plus} href={`${exchangePath}/list`}>
              {JOINED_COPY.addWishlist}
            </Button>
          </div>
        ) : null}
      </section>
    </InviteFrame>
  );
}
