"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { dismissRequest } from "../actions";
import { DRAW_COPY } from "../copy";

// GC-006 Dismiss on a request the draw closed (board Exchanges-active). A sibling of the row, never inside it.
export function DismissRequestButton({ requestId, exchangeName }: { requestId: string; exchangeName: string }) {
  const router = useRouter();
  const toast = useToast();
  const { online, reportNetworkError } = useNetworkStatus();
  const [busy, setBusy] = useState(false);

  async function dismiss() {
    if (busy || !online) return;
    setBusy(true);
    try {
      const result = await dismissRequest(requestId);
      setBusy(false);
      if (result.ok) return router.refresh();
      if (result.reason === "signed-out") return router.replace("/login?next=%2Fexchanges");
      toast.show({ message: DRAW_COPY.dismissFailed });
    } catch {
      setBusy(false);
      reportNetworkError();
    }
  }

  return (
    <Button variant="link" busy={busy} disabled={!online} onClick={dismiss}>
      <span aria-hidden="true">{DRAW_COPY.dismiss}</span>
      <span className="sr-only">{DRAW_COPY.dismissLabel(exchangeName)}</span>
    </Button>
  );
}
