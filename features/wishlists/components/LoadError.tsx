"use client";

import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

// GC-018 load error (board Wishlist-List-error) and the list version approved by the owner on
// 2026-11-05. Try again re-reads the page; nothing the person added is touched.
export function LoadError({ title }: { title: string }) {
  const router = useRouter();
  return (
    <Alert
      variant="error"
      title={title}
      action={
        <Button variant="link" onClick={() => router.refresh()}>
          Try again
        </Button>
      }
    >
      Something went wrong on our side. Nothing you&apos;ve added is lost.
    </Alert>
  );
}
