import { X } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { Button } from "@/components/ui/Button";

// The page around the invite screens (S02, S10, S13). Outside AppShell on purpose: the visitor may have
// no account, so there is no sidebar or tabs, only the wordmark. Boards: Entry-Invite-*, Joining-Confirm-*,
// Joining-Unavailable-* (m, d). Below 768 the actions are pinned at the bottom so they stay above the
// keyboard; from 768 one centred column with the actions under the content.
//
// `close` adds the × at the end of the header (You're in, S12: Joining-In-* boards).
export function InviteFrame({
  children,
  footer,
  close,
}: {
  children: ReactNode;
  footer?: ReactNode;
  close?: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <header className="flex min-h-48 items-center justify-between px-20 pt-16 md:px-40 md:pt-32">
        <p className="font-heading text-heading-4">Unwrap</p>
        {close ? <Button variant="icon" icon={X} label={close.label} href={close.href} /> : null}
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none md:items-center md:px-40 md:py-64">
        <div className="flex w-full flex-1 flex-col md:max-w-dialog md:flex-none md:gap-32">
          <div className="flex flex-1 flex-col gap-32 px-20 pb-24 pt-16 md:flex-none md:p-0">{children}</div>
          {footer ? (
            <div className="sticky bottom-0 flex flex-col gap-8 bg-surface-default px-20 pb-24 pt-12 md:static md:p-0">
              {footer}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
