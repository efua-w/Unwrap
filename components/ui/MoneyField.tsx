"use client";

import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useId, useLayoutEffect, useRef, type ChangeEvent } from "react";
import { groupNairaInput } from "@/lib/money/naira";
import { cx } from "./cx";
import { FIELD_CONTROL } from "./Field";
import { Icon } from "./Icon";

type Props = {
  label: string;
  name: string;
  /** What was typed, with thousands commas added by the field. The caller parses it
   *  (lib/money/naira.ts); the field never converts money. */
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  helper?: string;
  /** When set, replaces the helper and marks the field invalid. The typed value is kept. */
  error?: string;
  placeholder?: string;
  disabled?: boolean;
};

// Money field: ₦ prefix, whole naira (plan §4 "Fields: money"). Same control as Field; the ₦ sits
// over the input's left padding, so the input itself keeps the standard focus ring.
export function MoneyField({ label, name, value, onChange, helper, error, placeholder, disabled = false }: Props) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const hasError = Boolean(error);
  const describedBy = hasError ? errorId : helper ? helperId : undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);

  // WHY: adding commas moves the text under the cursor, so put the cursor back after the same
  // number of digits it followed before.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const digitsBefore = caretDigits.current;
    if (!input || digitsBefore === null) return;
    caretDigits.current = null;
    let position = 0;
    for (let seen = 0; position < input.value.length && seen < digitsBefore; position++) {
      if (/\d/.test(input.value.charAt(position))) seen++;
    }
    input.setSelectionRange(position, position);
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    const grouped = groupNairaInput(raw);
    if (grouped !== raw) {
      const caret = event.target.selectionStart ?? raw.length;
      caretDigits.current = raw.slice(0, caret).replace(/\D/g, "").length;
      event.target.value = grouped;
    }
    onChange(event);
  }

  return (
    <div className="flex flex-col gap-8">
      <label htmlFor={id} className="text-body-sm-semibold text-text-default">
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden
          className={cx(
            "pointer-events-none absolute inset-y-0 left-16 flex items-center text-body-base-medium",
            disabled ? "text-text-disabled" : "text-text-muted",
          )}
        >
          ₦
        </span>
        <input
          id={id}
          name={name}
          ref={inputRef}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          // WHY numeric, not decimal: whole naira only, so phones show digits without a decimal point.
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cx(
            FIELD_CONTROL,
            hasError ? "border-2 border-border-error" : "border-1 border-border-input",
            "h-48 pl-40",
          )}
        />
      </div>
      {hasError ? (
        <p id={errorId} role="alert" className="flex items-start gap-8 text-body-sm-regular text-text-error">
          <Icon icon={WarningCircle} size="sm" weight="fill" className="mt-2" />
          <span>{error}</span>
        </p>
      ) : helper ? (
        <p id={helperId} className="text-body-sm-regular text-text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
