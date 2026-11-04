"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";

type Props = {
  children: ReactNode;
  className: string;
  busy: boolean;
  ariaLabel?: string;
  href?: string;
  type?: "button" | "submit" | "reset";
  form?: string;
  name?: string;
  value?: ComponentPropsWithoutRef<"button">["value"];
  autoFocus?: boolean;
  ariaExpanded?: ComponentPropsWithoutRef<"button">["aria-expanded"];
  ariaControls?: string;
  ariaHasPopup?: ComponentPropsWithoutRef<"button">["aria-haspopup"];
  disabled?: boolean;
  onClick?: ComponentPropsWithoutRef<"button">["onClick"];
};

// WHY: a busy control must not act, but must keep focus (AC-12), so it is aria-disabled rather than
// `disabled`. `type` is kept as given: Enter in a field fires a synthetic click on the form's
// default submit button, and preventing that click is what blocks the re-submit. Swapping to
// type="button" would remove the default button and let a one-field form submit anyway. The same
// preventDefault stops a busy link navigating from the keyboard (R1-1).
export function ButtonControl({
  children,
  className,
  busy,
  ariaLabel,
  href,
  type,
  form,
  name,
  value,
  autoFocus,
  ariaExpanded,
  ariaControls,
  ariaHasPopup,
  disabled,
  onClick,
}: Props) {
  const guard = (event: MouseEvent<HTMLElement>) => {
    if (busy) event.preventDefault();
  };

  if (href !== undefined) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        aria-busy={busy || undefined}
        aria-disabled={busy || undefined}
        onClick={guard}
        className={className}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      form={form}
      name={name}
      value={value}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-haspopup={ariaHasPopup}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      disabled={disabled}
      onClick={(event) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={className}
    >
      {children}
    </button>
  );
}
