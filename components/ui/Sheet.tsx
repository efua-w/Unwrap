"use client";

import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from "react";
import { announceModalClosed, isModalOpen } from "./top-layer";

export type SheetVariant = "confirm" | "destructive" | "form";

type Props = {
  open: boolean;
  onClose: () => void;
  variant: SheetVariant;
  title: string;
  description?: string;
  /** Blocks every way of closing while an action is running. */
  busy?: boolean;
  /** The actions. Pinned to the bottom of the sheet so a mobile keyboard never covers them. */
  footer: ReactNode;
  children?: ReactNode;
};

// Bottom sheet below 768, centred dialog from 768. Built on native <dialog>.showModal(), which
// gives the focus trap, the inert background and Esc for free. No swipe to close (out of scope).
export function Sheet({ open, onClose, variant, title, description, busy = false, footer, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusTo = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusTo.current = document.activeElement;
      delete dialog.dataset.reopened;
      dialog.showModal();
      document.documentElement.classList.add("scroll-lock");
      // WHY: focus the heading, not the first button, so a destructive action is never pre-focused (A4).
      headingRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      const wasOpen = dialog?.open ?? false;
      if (wasOpen) dialog?.close();
      // WHY: another sheet may have opened in the same commit (Edit list handing over to Delete, R1-10).
      if (!isModalOpen()) document.documentElement.classList.remove("scroll-lock");
      // WHY: the unmounted dialog's React close handler never runs, so tell held toasts (item 12).
      if (wasOpen) announceModalClosed();
    };
  }, []);

  function handleClose() {
    // WHY: a second Esc or the Android back gesture closes the dialog without a cancelable
    // `cancel` event. While busy, put it back so the dialog and the parent stay in step (R1-3).
    const dialog = dialogRef.current;
    if (busy && open && dialog && !dialog.open) {
      // WHY: the heading takes focus again, since focus may otherwise land on a destructive
      // button, and the entrance animation is skipped because the dialog never really left (R2-2).
      dialog.dataset.reopened = "true";
      dialog.showModal();
      headingRef.current?.focus();
      return;
    }
    // WHY: `close` fires asynchronously. A sheet mounted with open=true is closed and re-opened by
    // StrictMode's double effect (T1-1), so the event can land after the dialog is open again. A real
    // close leaves the dialog closed, so an open dialog here means the event is stale: ignore it.
    if (dialog?.open) return;
    // Fires after any close, including the browser closing it. Restore page state, then tell the parent.
    // WHY: when one sheet hands over to another, the second is already open and keeps the lock (R1-10).
    if (!isModalOpen()) document.documentElement.classList.remove("scroll-lock");
    const target = returnFocusTo.current;
    returnFocusTo.current = null;
    if (target instanceof HTMLElement) target.focus();
    if (open) onClose();
    announceModalClosed();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Esc closes every variant (A3), except while busy.
    event.preventDefault();
    if (!busy) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={busy || undefined}
      role={variant === "destructive" ? "alertdialog" : undefined}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={(event) => {
        // Only a click on the backdrop itself (the dialog element, not its content) counts.
        if (event.target === event.currentTarget && variant !== "destructive" && !busy) onClose();
      }}
      className="sheet fixed inset-x-0 bottom-0 top-auto m-0 max-h-9/10 w-full max-w-none overflow-y-auto rounded-t-3xl bg-surface-default p-0 text-text-default shadow-overlay backdrop:bg-surface-overlay md:inset-0 md:m-auto md:h-fit md:max-w-dialog md:rounded-3xl"
    >
      <div className="flex flex-col gap-16 px-24 pt-24">
        <h2 ref={headingRef} id={titleId} tabIndex={-1} className="text-heading-4 focus:outline-none">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="text-body-base-regular text-text-secondary">
            {description}
          </p>
        ) : null}
        {children}
      </div>
      <div className="sticky bottom-0 flex flex-col gap-12 bg-surface-default px-24 pb-24 pt-16">{footer}</div>
    </dialog>
  );
}
