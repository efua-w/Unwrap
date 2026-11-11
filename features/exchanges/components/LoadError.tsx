"use client";

import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

// S14 Exchange-Detail-error and S08 Exchanges-error: one line, and Try again re-reads the page.
// Nothing is written by a read, so nothing has changed.
export function LoadError({ children }: { children: string }) {
  const router = useRouter();
  return (
    <Alert
      variant="error"
      action={
        <Button variant="link" onClick={() => router.refresh()}>
          Try again
        </Button>
      }
    >
      {children}
    </Alert>
  );
}
