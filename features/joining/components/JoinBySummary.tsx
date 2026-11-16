import { LocalDateTime } from "@/components/ui/LocalDateTime";
import { EXCHANGE_COPY } from "@/features/exchanges/copy";
import { lastJoinDay } from "@/features/exchanges/timeline";
import { zoneShortName } from "@/lib/dates/format";
import { INVITE_COPY } from "../copy";
import type { JoinDetails } from "../types";
import { DetailRows } from "./DetailRows";

// The one row on the request-sent state (board Joining-Confirm-requested): when joining ends, in the
// viewer's zone. Rendered on the server and handed to the client AskToJoin as a node.
export function JoinBySummary({ details, timeZone }: { details: JoinDetails; timeZone: string }) {
  const manual = details.drawMode === "organiser_chooses" || details.drawAt === null;
  const schedule = {
    joinByAt: details.joinByAt,
    drawMode: details.drawMode,
    drawAt: details.drawAt,
    giftDay: details.giftDay,
    // WHY false: lastJoinDay reads the join-by and draw mode only.
    approvalRequired: false,
  };
  return (
    <DetailRows
      zoneLine={INVITE_COPY.zoneLine(zoneShortName(new Date(details.joinByAt), timeZone))}
      rows={[
        {
          label: INVITE_COPY.joinBy,
          value: manual ? (
            EXCHANGE_COPY.flow.rules.endOfDay(lastJoinDay(schedule, timeZone))
          ) : (
            <LocalDateTime value={details.joinByAt} timeZone={timeZone} format="dayTime" />
          ),
        },
      ]}
    />
  );
}
