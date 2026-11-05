"use client";

import { useTransition } from "react";
import { useNetworkStatus } from "@/components/layout/NetworkStatusProvider";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/features/auth/actions";
import { clearStoredVerifyState } from "@/features/auth/verify-storage";

// GC-024: ends this device's session only, then lands on Landing (the action redirects).
export function LogOutButton() {
  const [pending, startTransition] = useTransition();
  const { online, reportNetworkError } = useNetworkStatus();

  return (
    <Button
      variant="secondary"
      busy={pending}
      disabled={!online}
      onClick={() =>
        startTransition(async () => {
          // WHY: the saved verify state holds an email address; it must not outlive the session on a shared device.
          clearStoredVerifyState();
          try {
            await signOut();
          } catch {
            // WHY: the action redirects on success, so a throw here is a request that never reached the server.
            reportNetworkError();
          }
        })
      }
    >
      Log out
    </Button>
  );
}
