import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { SHARED_COPY } from "../copy";

// The page around the public shared wishlist (S25, GC-023). It sits outside AppShell on purpose: a
// visitor has no account, so there is no sidebar, tabs or profile. Boards: Wishlist-Shared-* (m, d):
// the wordmark and "What is Unwrap?" on top, one centred column below (every state, 2026-11-09).
export function SharedFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex min-h-48 w-full max-w-content-max items-center justify-between px-20 pt-16 md:px-40 md:pt-32">
        <p className="font-heading text-heading-4">Unwrap</p>
        <Button variant="link" href="/">
          {SHARED_COPY.whatIsUnwrap}
        </Button>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-content-max flex-1 px-20 pb-32 pt-24 focus:outline-none md:px-40 md:pb-64"
      >
        <div className="flex flex-col gap-24 md:mx-auto md:max-w-reading-max">{children}</div>
      </main>
    </div>
  );
}
