import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { InviteFrame } from "./InviteFrame";

// Boards Entry-Invite-loading and Joining-Confirm-loading: the wordmark, skeletons for the inviter, title
// and dates, and the actions disabled while the link resolves (GC-002).
export function InviteSkeleton({ actions }: { actions: ReadonlyArray<{ label: string; variant?: "text" }> }) {
  return (
    <InviteFrame
      footer={actions.map((a) => (
        <Button key={a.label} variant={a.variant} fullWidth disabled>
          {a.label}
        </Button>
      ))}
    >
      <SkeletonRegion>
        <Skeleton shape="line" text="lg" className="w-2/3" />
        <Skeleton shape="line" text="lg" className="w-full" />
        <Skeleton shape="row" />
        <Skeleton shape="row" />
        <Skeleton shape="row" />
      </SkeletonRegion>
    </InviteFrame>
  );
}
