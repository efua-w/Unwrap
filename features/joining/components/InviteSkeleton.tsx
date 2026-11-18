import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { InviteFrame } from "./InviteFrame";

const LINE = "h-16 rounded-full";

// Boards Join-Exchange-loading-m/-d: inviter (round + line), tile and title, a stack of three faces and
// four lines of text, with the actions disabled while the link resolves (GC-002, GC-009).
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
        <div role="status" aria-label="Loading the exchange" className="flex flex-col gap-32">
          <div className="flex items-center gap-12">
            <Skeleton shape="box" className="size-avatar-sm shrink-0 rounded-full" />
            <Skeleton shape="box" className={`w-1/2 ${LINE}`} />
          </div>
          <div className="flex flex-col gap-12">
            <Skeleton shape="box" className="size-48 rounded-xl" />
            <Skeleton shape="box" className="h-32 w-4/5 rounded-full" />
          </div>
          <div className="flex">
            <Skeleton shape="box" className="size-avatar-sm rounded-full" />
            <Skeleton shape="box" className="-ml-6 size-avatar-sm rounded-full" />
            <Skeleton shape="box" className="-ml-6 size-avatar-sm rounded-full" />
          </div>
          <div className="flex flex-col gap-16">
            <Skeleton shape="box" className={`w-full ${LINE}`} />
            <Skeleton shape="box" className={`w-9/10 ${LINE}`} />
            <Skeleton shape="box" className={`w-7/10 ${LINE}`} />
            <Skeleton shape="box" className={`w-4/5 ${LINE}`} />
          </div>
        </div>
      </SkeletonRegion>
    </InviteFrame>
  );
}
