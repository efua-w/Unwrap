import type { Metadata } from "next";
import { StatusPage } from "@/components/layout/StatusPage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// Any address the app does not have (audit finding 4, 2026-11-13), including sections a later slice
// builds, such as Activity (owner decision 2026-11-13: the tab stays, per GC-006). No board: the title
// and body are in docs/copy-pending.md. "Back to Home" is S47's button; a signed-out visitor is sent
// on to Log in from there. Shared wishlist links keep their own page (app/(public)/w/[shareToken]).
export const metadata: Metadata = { title: "Unwrap", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <StatusPage>
      <EmptyState
        headingLevel={1}
        title="This page isn't available"
        body="The link may be old or mistyped. Nothing you've added has been lost."
        action={<Button href="/home">Back to Home</Button>}
      />
    </StatusPage>
  );
}
