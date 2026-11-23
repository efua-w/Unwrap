import { Envelope } from "@phosphor-icons/react/dist/ssr";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { NotAvailable } from "@/features/exchanges/components/NotAvailable";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { getOrganiserExchange } from "@/features/exchanges/queries";
import { DetailRows } from "@/features/joining/components/DetailRows";
import { InviteFrame } from "@/features/joining/components/InviteFrame";
import { formatYmdDay, zoneShortName } from "@/lib/dates/format";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";
import { DRAW_COPY } from "../copy";
import { drawnBody } from "../format";
import { getDrawSummary } from "../queries";

// GCO-012 Names drawn (S36; boards Org-Drawn-part, Org-Drawn-just). Organiser only, and only while names are drawn (owner
// Q10): everyone else, and an exchange that is not drawn, gets the same "isn't available" as any other missing exchange
// (GC-029). WHY the organiser's page has a count and a time and nothing else: nobody can see who got whom, not even the
// organiser, and no function gives them a pair. WHY the frame wraps every state: the page is standalone (wordmark and ×).
export async function DrawnContent({ id, viewerId }: { id: string; viewerId: string }) {
  const close = { href: `/exchanges/${id}`, label: DRAW_COPY.closeLabel };
  let loaded;
  try {
    const detail = await getOrganiserExchange(id, viewerId);
    loaded = detail && detail.exchange.state === "drawn" ? { exchange: detail.exchange, summary: await getDrawSummary(id) } : null;
  } catch {
    return (
      <InviteFrame close={close}>
        <LoadError>{EXCHANGE_COPY.detail.loadError}</LoadError>
      </InviteFrame>
    );
  }
  if (!loaded || !loaded.summary) {
    return (
      <InviteFrame>
        <NotAvailable />
      </InviteFrame>
    );
  }
  const { exchange, summary } = loaded;
  const timeZone = await readViewerTimeZone();
  const copy = DRAW_COPY;
  const exchangePath = `/exchanges/${exchange.id}`;
  return (
    <InviteFrame
      close={close}
      footer={
        exchange.takingPart ? (
          <>
            <Button variant="brand" icon={Envelope} fullWidth href={`${exchangePath}/reveal`}>
              {copy.revealCta}
            </Button>
            <Button variant="text" fullWidth href={exchangePath}>
              {copy.backToExchange}
            </Button>
          </>
        ) : (
          <Button fullWidth href={exchangePath}>
            {copy.backToExchange}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-8">
        <span className="break-words text-body-sm-semibold text-text-muted">{exchange.name}</span>
        <h1 className="text-heading-2">{copy.drawnTitle}</h1>
        <p className="text-body-base-regular text-text-secondary">{drawnBody(summary)}</p>
      </div>
      <DetailRows
        rows={[
          { label: copy.toldLabel, value: copy.toldValue(summary.told, summary.peopleCount) },
          { label: copy.giftsLabel, value: formatYmdDay(exchange.giftDay) ?? "" },
        ]}
        zoneLine={copy.zoneLine(zoneShortName(new Date(summary.drawnAt), timeZone))}
      />
      <Alert variant="privacy">{copy.drawnPrivacy}</Alert>
    </InviteFrame>
  );
}
