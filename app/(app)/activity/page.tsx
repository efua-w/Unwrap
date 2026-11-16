import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeading } from "@/components/layout/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkeletonRegion } from "@/components/ui/SkeletonRegion";
import { ActivityFeed } from "@/features/activity/components/ActivityFeed";
import { ACTIVITY_COPY } from "@/features/activity/copy";
import { getActivityPage, getUnreadActivityCount } from "@/features/activity/queries";
import type { ActivityPage } from "@/features/activity/types";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { requireProfile } from "@/lib/auth/session";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";

// S09 Activity (GC-006, GCO-003). Boards: Activity-default, -allread, -empty, -error, -loading, -offline,
// -older (m and d). Slice 6 writes two kinds of event, "{Name} joined {exchange}." and "{Name} asked to join
// {exchange}."; the other kinds arrive with slices 7 to 10. The "Choose which emails you get" link waits for
// slice 7 (owner Q12).
export default async function ActivityPage() {
  const profile = await requireProfile("/activity");
  return (
    <AppShell profile={{ name: profile.displayName }} top="heading">
      <div className="flex flex-col gap-24 md:max-w-reading-max">
        <PageHeading profile={{ name: profile.displayName }}>{ACTIVITY_COPY.title}</PageHeading>
        <Suspense fallback={<ActivityLoading />}>
          <ActivityContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

// Board Activity-loading: five rows.
function ActivityLoading() {
  return (
    <SkeletonRegion>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} shape="row" />
      ))}
    </SkeletonRegion>
  );
}

async function ActivityContent() {
  let page: ActivityPage;
  let unread: number;
  try {
    const timeZone = await readViewerTimeZone();
    [page, unread] = await Promise.all([getActivityPage(null, new Date(), timeZone), getUnreadActivityCount()]);
  } catch {
    return <LoadError>{ACTIVITY_COPY.loadError}</LoadError>;
  }

  if (page.items.length === 0) {
    return <EmptyState icon={CheckCircle} title={ACTIVITY_COPY.emptyTitle} body={ACTIVITY_COPY.emptyBody} />;
  }
  return <ActivityFeed initialItems={page.items} initialCursor={page.cursor} unreadCount={unread} />;
}
