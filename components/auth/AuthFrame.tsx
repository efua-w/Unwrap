import type { FormEventHandler, ReactNode } from "react";
import { BackButton, Header } from "@/components/layout/Header";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

type Props = {
  title: string;
  intro?: ReactNode;
  /** A small line above the title, such as "Start an exchange · Step 1 of 3". */
  eyebrow?: string;
  /** A control at the end of the wordmark row, such as Close on Start exchange. Outside the form. */
  headerAction?: ReactNode;
  /** Parent page for Back. Omit on Profile setup, which has no Back (S06). */
  backHref?: string;
  /** The fields, between the title and the actions. */
  children?: ReactNode;
  /** The actions. Pinned to the bottom of the screen below 768, so they stay above the keyboard. */
  footer?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

// The shared frame of the entry screens (S03 Sign up, S04 Log in, S05 Verify, S06 Profile setup).
// Below 768: a Back bar (or the wordmark), the content, and the actions pinned at the bottom.
// From 768: the wordmark top left and one centred column with the actions under the fields.
// Boards: Entry-Signup / Login / Verify / Profile, default-m and default-d.
export function AuthFrame({ title, intro, eyebrow, headerAction, backHref, children, footer, onSubmit }: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      {backHref ? (
        <>
          <Header variant="back" back={{ label: "Go back", href: backHref }} />
          <header className="min-h-48 items-center px-40 pt-32 max-md:hidden md:flex">
            <p className="font-heading text-heading-4">Unwrap</p>
          </header>
        </>
      ) : (
        <header className="flex min-h-48 items-center justify-between gap-16 pl-20 pr-12 pt-16 md:px-40 md:pt-32">
          <p className="font-heading text-heading-4">Unwrap</p>
          {headerAction}
        </header>
      )}
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none md:items-center md:px-40 md:py-64">
        {/* WHY method="post": if the form is submitted before the page's JavaScript runs (slow
            mobile network, or a dev server blocking the phone's origin), a default GET would put
            the email and first name in the URL, server logs and browser history. POST keeps them
            out of the URL; the JavaScript handler still owns every real submission. */}
        <form method="post" noValidate onSubmit={onSubmit} className="flex w-full flex-1 flex-col md:max-w-dialog md:flex-none md:gap-32">
          {backHref ? (
            <div className="max-md:hidden">
              <BackButton back={{ label: "Go back", href: backHref }} />
            </div>
          ) : null}
          <div className="flex flex-1 flex-col gap-32 px-20 pb-24 pt-16 md:flex-none md:p-0">
            <div className="flex flex-col gap-8">
              {eyebrow ? <span className="text-body-sm-semibold text-text-muted">{eyebrow}</span> : null}
              <h1 className="text-heading-1">{title}</h1>
              {intro ? <p className="text-body-base-regular text-text-secondary">{intro}</p> : null}
            </div>
            {children}
          </div>
          {footer ? (
            <div className="sticky bottom-0 flex flex-col gap-8 bg-surface-default px-20 pb-24 pt-12 md:static md:p-0">
              {footer}
            </div>
          ) : null}
        </form>
      </main>
    </div>
  );
}
