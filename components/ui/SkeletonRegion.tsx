"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./Button";

export const SKELETON_DELAY_MS = 300;
export const SLOW_AFTER_MS = 8000;

// Mount this as the loading state (for example a Suspense fallback). Its lifetime is the load:
// nothing shows for 300ms so quick loads never flash, then skeletons, then the slow line at 8s.
export function SkeletonRegion({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), SKELETON_DELAY_MS);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(slowTimer);
    };
  }, []);

  return (
    <div className="flex flex-col gap-12">
      <div aria-busy="true" className="flex flex-col gap-12">
        {visible ? children : null}
      </div>
      {/* WHY: the slow-line status is a sibling of the aria-busy block, not inside it, because a
          live region inside aria-busy is not announced (R1-7). Always mounted, so the message is
          announced when it appears (GC-020). */}
      <div role="status" className="flex flex-col items-start gap-4">
        {slow ? (
          <>
            <p className="text-body-sm-regular text-text-muted">Taking longer than usual.</p>
            <Button variant="link" onClick={() => router.refresh()}>
              Try again
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
