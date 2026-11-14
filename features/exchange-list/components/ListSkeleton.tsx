import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";

// Loading state for Attach list and You're in: a heading, a line, then rows (no board; mirrors the
// layout so nothing jumps). Mounted as the Suspense fallback, so its lifetime is the load.
export function ListSkeleton() {
  return (
    <SkeletonRegion>
      <Skeleton shape="line" text="lg" className="w-2/3" />
      <Skeleton shape="line" text="sm" className="w-1/2" />
      <Skeleton shape="row" />
      <Skeleton shape="row" />
    </SkeletonRegion>
  );
}
