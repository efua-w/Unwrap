"use client";

import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ExchangeTag } from "@/components/ui/ExchangeTag";
import { Icon } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { Spinner } from "@/components/ui/Spinner";
import { loadOlderActivity, markAllActivityRead } from "../actions";
import { ACTIVITY_COPY } from "../copy";
import { groupByDay } from "../group";
import type { ActivityCursor, ActivityItem } from "../types";

type Props = {
  initialItems: readonly ActivityItem[];
  initialCursor: ActivityCursor | null;
  /** The database's count of everything unread, which can be more than the rows shown. */
  unreadCount: number;
};

// S09 Activity list (GC-006; boards Activity-default, -allread, -older, -offline m and d). Rows come from
// the server already worded in the viewer's zone. Only Mark all as read marks events read (owner Q12): a
// tap on a row just goes to the exchange.
export function ActivityFeed({ initialItems, initialCursor, unreadCount }: Props) {
  const copy = ACTIVITY_COPY;
  const router = useRouter();
  const { online, reportNetworkError } = useNetworkStatus();
  const [items, setItems] = useState<readonly ActivityItem[]>(initialItems);
  const [cursor, setCursor] = useState<ActivityCursor | null>(initialCursor);
  const [allRead, setAllRead] = useState(false);
  const [marking, setMarking] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  const unread = allRead ? 0 : unreadCount;

  async function markAll() {
    if (marking || !online) return;
    setMarking(true);
    setFailure(null);
    try {
      const result = await markAllActivityRead();
      if (!result.ok) {
        setFailure(copy.markFailed);
        return;
      }
      setAllRead(true);
      setItems((all) => all.map((item) => ({ ...item, isUnread: false })));
      // WHY: the Mark all button leaves with the last unread row, so focus goes to the line that now says
      // "No unread activity" rather than the top of the page.
      requestAnimationFrame(() => summaryRef.current?.focus());
      // WHY: the badge lives in the shell; refreshing re-reads it.
      router.refresh();
    } catch {
      reportNetworkError();
      setFailure(copy.markFailed);
    } finally {
      setMarking(false);
    }
  }

  async function older() {
    if (!cursor || loadingOlder || !online) return;
    setLoadingOlder(true);
    setFailure(null);
    try {
      const result = await loadOlderActivity(cursor.beforeAt, cursor.beforeId);
      if (!result.ok) {
        setFailure(copy.olderFailed);
        return;
      }
      // WHY the unread flag follows allRead: older rows loaded after Mark all as read were read by it too.
      setItems((all) => [...all, ...result.items.map((item) => (allRead ? { ...item, isUnread: false } : item))]);
      setCursor(result.cursor);
    } catch {
      reportNetworkError();
      setFailure(copy.olderFailed);
    } finally {
      setLoadingOlder(false);
    }
  }

  const days = groupByDay(items);

  return (
    <div className="flex flex-col gap-24">
      <div className="flex items-center justify-between gap-16">
        <p ref={summaryRef} role="status" tabIndex={-1} className="text-body-sm-regular text-text-muted focus:outline-none">
          {unread > 0 ? copy.unread(unread) : copy.noneUnread}
        </p>
        {unread > 0 ? (
          <Button variant="link" onClick={markAll} busy={marking} disabled={!online}>
            {copy.markAll}
          </Button>
        ) : null}
      </div>
      {failure ? <Alert variant="error">{failure}</Alert> : null}
      <div className="flex flex-col">
        {days.map((day) => (
          <section key={day.key} aria-labelledby={`activity-day-${day.key}`} className="flex flex-col">
            <h2 id={`activity-day-${day.key}`} className="pt-8 text-body-sm-semibold text-text-muted">
              {day.label}
            </h2>
            <ul className="flex flex-col">
              {day.items.map((item, index) => (
                <ListRow
                  key={item.id}
                  href={`/exchanges/${item.exchangeId}`}
                  leading={
                    <>
                      {/* WHY a word beside the dot: colour alone must not say "unread" (CLAUDE.md UI rules). */}
                      {item.isUnread ? (
                        <span className="size-8 shrink-0 rounded-full bg-surface-brand">
                          <span className="sr-only">{copy.unreadMarker}</span>
                        </span>
                      ) : null}
                      <ExchangeTag name={item.exchangeName} tint={item.exchangeTint} />
                    </>
                  }
                  title={item.title}
                  sub={item.sub}
                  quiet={!item.isUnread}
                  meta={<Icon icon={CaretRight} className="text-text-muted" />}
                  divider={index > 0}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {cursor ? (
        <div className="flex flex-col items-start gap-8">
          {loadingOlder ? (
            <p role="status" className="flex min-h-touch-target items-center gap-8 text-body-sm-regular text-text-muted">
              <Spinner />
              {copy.olderBusy}
            </p>
          ) : (
            <Button variant="secondary" onClick={older} disabled={!online}>
              {copy.older}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
