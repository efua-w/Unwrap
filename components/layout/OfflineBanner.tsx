"use client";

import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useNetworkStatus } from "./NetworkStatusProvider";

// Copy: GC-029 Content, exact. The banner never promises to save changes later.
// Rendered by AppShell at the top of the content column. A page without AppShell must render it itself.
export function OfflineBanner() {
  const { online, reportNetworkSuccess } = useNetworkStatus();
  const router = useRouter();

  return (
    // WHY: the status wrapper is always mounted, because a live region inserted together with its
    // content is not announced (R1-6). Alert has no role of its own here. A live region is also
    // exempt from the "all content in a landmark" rule, so the banner needs no landmark (R1-17).
    <div role="status" className="sticky top-0 z-10">
      {online ? null : (
        <div className="bg-surface-default p-8">
          <Alert
            variant="offline"
            action={
              <Button
                variant="link"
                onClick={() => {
                  // WHY: refreshing while still offline would just fail again (GC-029). When the
                  // browser says it is online, clear a banner raised by a failed request and retry.
                  if (!navigator.onLine) return;
                  reportNetworkSuccess();
                  router.refresh();
                }}
              >
                Try again
              </Button>
            }
          >
            You&apos;re offline. Pages you&apos;ve opened stay on screen.
          </Alert>
        </div>
      )}
    </div>
  );
}
