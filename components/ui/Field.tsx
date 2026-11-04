import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useId, type ComponentPropsWithoutRef } from "react";
import { CharacterCount } from "./CharacterCount";
import { cx } from "./cx";
import { Icon } from "./Icon";

type Common = {
  label: string;
  name: string;
  helper?: string;
  /** When set, replaces the helper and marks the field invalid. The form keeps the typed value. */
  error?: string;
  /** Shows a live "n/max" counter and enforces the limit on the field. */
  maxLength?: number;
};

type Reserved = "id" | "className" | "name" | "maxLength" | "aria-invalid" | "aria-describedby" | "children";

type InputField = Common & { multiline?: false } & Omit<ComponentPropsWithoutRef<"input">, Reserved>;
type TextareaField = Common & { multiline: true } & Omit<ComponentPropsWithoutRef<"textarea">, Reserved>;

export type FieldProps = InputField | TextareaField;

// WHY: 16px value text (text-body-base) stops iOS Safari zooming the page on focus.
const CONTROL =
  "w-full rounded-lg bg-surface-default px-16 text-body-base-regular text-text-default placeholder:text-text-placeholder focus-ring disabled:border-border-default disabled:bg-surface-muted disabled:text-text-disabled";

export function Field(props: FieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const { label, helper, error, maxLength, multiline, ...rest } = props;
  const hasError = Boolean(error);
  const border = hasError ? "border-2 border-border-error" : "border-1 border-border-input";
  const describedBy = hasError ? errorId : helper ? helperId : undefined;
  const initial = String(rest.value ?? rest.defaultValue ?? "").length;

  return (
    <div className="flex flex-col gap-8">
      <label htmlFor={id} className="text-body-sm-semibold text-text-default">
        {label}
      </label>
      {multiline ? (
        <textarea
          {...(rest as ComponentPropsWithoutRef<"textarea">)}
          id={id}
          maxLength={maxLength}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cx(CONTROL, border, "min-h-textarea-min field-sizing-content py-12")}
        />
      ) : (
        <input
          {...(rest as ComponentPropsWithoutRef<"input">)}
          id={id}
          maxLength={maxLength}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cx(CONTROL, border, "h-48")}
        />
      )}
      {hasError || helper || maxLength ? (
        <div className="flex items-start gap-8">
          {hasError ? (
            <p id={errorId} className="flex items-start gap-8 text-body-sm-regular text-text-error">
              <Icon icon={WarningCircle} size="sm" weight="fill" className="mt-2" />
              <span>{error}</span>
            </p>
          ) : helper ? (
            <p id={helperId} className="text-body-sm-regular text-text-muted">
              {helper}
            </p>
          ) : null}
          {maxLength ? <CharacterCount targetId={id} max={maxLength} initial={initial} /> : null}
        </div>
      ) : null}
    </div>
  );
}
