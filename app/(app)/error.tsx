"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { StatusPage } from "@/components/layout/StatusPage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// A signed-in page that throws (audit finding 4, 2026-11-13; GC-029 pattern; open item 34): a failing
// profile read, a missing profile row, or any other server error lands here instead of Next's own
// error page. WHY nothing from `error` is shown: its message can carry server detail the person must
// not see (CLAUDE.md "Copy rules"). Copy reused from the approved load-error lines.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <StatusPage>
      <EmptyState
        headingLevel={1}
        title="Something went wrong on our side."
        body="Nothing you've added is lost."
        action={
          <Button
            onClick={() =>
              // WHY both: refresh asks the server again, reset re-renders the page that failed.
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
          >
            Try again
          </Button>
        }
      />
    </StatusPage>
  );
}
