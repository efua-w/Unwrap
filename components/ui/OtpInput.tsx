"use client";

import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useId, type ChangeEvent, type ClipboardEvent, type Ref } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { digitsOnly, OTP_LENGTH } from "./otp-digits";
import { Spinner } from "./Spinner";

type Props = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Called once, from the keystroke or paste that fills the last digit. */
  onComplete: (code: string) => void;
  helper?: string;
  /** When set, replaces the helper and marks the field invalid. */
  error?: string;
  /** Shows "Checking your code" and ignores typing until it ends. */
  checking?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Lets the screen put focus back after a wrong code. */
  inputRef?: Ref<HTMLInputElement>;
  /** The label shown beside the spinner while checking. */
  checkingLabel?: string;
};

// plan §4: ONE real <input>, styled as six boxes. A single input keeps phone autofill ("code from
// Mail"), paste and screen readers working, which six separate inputs break. The boxes are
// decoration (aria-hidden); the input is invisible but fills the whole area, so a tap anywhere
// focuses it.
export function OtpInput({
  label,
  name,
  value,
  onChange,
  onComplete,
  helper,
  error,
  checking = false,
  disabled = false,
  autoFocus = false,
  inputRef,
  checkingLabel = "Checking your code",
}: Props) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const hasError = Boolean(error);
  const describedBy = hasError ? errorId : helper && !checking ? helperId : undefined;

  const apply = (next: string) => {
    if (next === value) return;
    onChange(next);
    // WHY here and not in an effect: one keystroke or one paste can fire this exactly once.
    if (next.length === OTP_LENGTH) onComplete(next);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (checking) return;
    apply(digitsOnly(event.target.value));
  };

  // WHY: maxLength would cut "123 456" to "123 45" before the spaces are stripped, so a pasted
  // code is read from the clipboard text directly.
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (checking || disabled) return;
    apply(digitsOnly(event.clipboardData.getData("text")));
  };

  const active = value.length < OTP_LENGTH ? value.length : OTP_LENGTH - 1;

  return (
    <div className="flex flex-col gap-8">
      <label htmlFor={id} className="text-body-sm-semibold text-text-default">
        {label}
      </label>
      <div className="group relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          pattern="[0-9]*"
          autoFocus={autoFocus}
          disabled={disabled}
          readOnly={checking}
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          aria-busy={checking || undefined}
          // WHY: text-size 16px stops iOS Safari zooming the page on focus, even though the text is invisible. focus-ring keeps the focus outline contract of every control (the visible indicator is the dark border on the box taking the next digit, because this input is transparent).
          className="absolute inset-0 z-10 size-full cursor-text text-body-base-regular opacity-0 focus-ring disabled:cursor-not-allowed"
        />
        <div aria-hidden className="grid grid-cols-6 gap-8">
          {Array.from({ length: OTP_LENGTH }, (_, i) => {
            const focused = i === active;
            return (
              <span
                key={i}
                className={cx(
                  "flex h-control-lg items-center justify-center rounded-lg text-body-2xl-semibold",
                  disabled
                    ? "border-1 border-border-default bg-surface-muted text-text-disabled"
                    : "bg-surface-default text-text-default",
                  !disabled && (hasError ? "border-2 border-border-error" : "border-1 border-border-input"),
                  // WHY: the focus indicator is the 2px border on the box that takes the next digit; the
                  // real input is invisible, so this is what a keyboard user sees.
                  !disabled && !hasError && focused && "group-focus-within:border-2 group-focus-within:border-border-focus",
                )}
              >
                {value[i] ?? ""}
              </span>
            );
          })}
        </div>
      </div>
      {/* WHY: always mounted, because a live region inserted together with its text is not announced. */}
      <p role="status" className={checking ? "flex items-center gap-8 text-body-sm-regular text-text-secondary" : "sr-only"}>
        {checking ? (
          <>
            <Spinner size="sm" />
            {checkingLabel}
          </>
        ) : null}
      </p>
      {hasError ? (
        <p id={errorId} role="alert" className="flex items-start gap-8 text-body-sm-regular text-text-error">
          <Icon icon={WarningCircle} size="sm" weight="fill" className="mt-2" />
          <span>{error}</span>
        </p>
      ) : helper && !checking ? (
        <p key={disabled ? "locked" : "helper"} id={helperId} role={disabled ? "alert" : undefined} className="text-body-sm-regular text-text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
