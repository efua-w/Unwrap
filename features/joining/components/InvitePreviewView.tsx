import type { InvitePreview } from "../types";
import { InviteActions } from "./InviteActions";
import { InviteFrame } from "./InviteFrame";
import { JoinContent } from "./JoinContent";

// The signed-out view of the one invite screen (GC-002; board Join-Exchange-guest). Public: it shows the
// inviter, the exchange and a count, never a face or name of anyone else and never the organiser's note
// (owner decision 1, 2026-11-18; GC-002 context C). Signed in, the page shows JoinForm or AskToJoin instead.
export function InvitePreviewView({ preview, token, timeZone }: { preview: InvitePreview; token: string; timeZone: string }) {
  return (
    <InviteFrame footer={<InviteActions token={token} />}>
      <JoinContent
        timeZone={timeZone}
        audience={{ kind: "guest", joinedCount: preview.joinedCount }}
        facts={{
          exchangeName: preview.exchangeName,
          tint: preview.tint,
          organiserName: preview.inviterName,
          budget: preview.budget,
          joinByAt: preview.joinByAt,
          drawMode: preview.drawMode,
          drawAt: preview.drawAt,
          giftDay: preview.giftDay,
        }}
      />
    </InviteFrame>
  );
}
