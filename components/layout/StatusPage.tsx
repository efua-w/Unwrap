import type { ReactNode } from "react";
import { OfflineBanner } from "./OfflineBanner";

// A whole-page state outside AppShell: the wordmark and one centred column (audit finding 4,
// 2026-11-13). Used by the app-wide not-found and error pages, which cannot assume a signed-in
// profile to build the shell from. Same frame as Landing and the entry screens.
export function StatusPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <header className="flex min-h-48 items-center px-20 pt-16 md:px-40 md:pt-32">
        <p className="font-heading text-heading-4">Unwrap</p>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col px-20 pb-24 pt-16 focus:outline-none md:items-center md:px-40 md:py-64">
        <div className="w-full md:max-w-dialog">{children}</div>
      </main>
    </div>
  );
}
