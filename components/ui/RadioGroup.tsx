import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useId } from "react";
import { Icon } from "./Icon";

export type RadioOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

type Props<T extends string> = {
  legend: string;
  name: string;
  options: readonly RadioOption<T>[];
  /** "" while nothing is chosen (no option is checked). */
  value: T | "";
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Shown under the options and read out with the group. The chosen value is kept. */
  error?: string;
};

// WHY native radios in a fieldset: arrow keys, one Tab stop for the group, and the group name
// read with each option all come from the browser.
export function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  disabled = false,
  error,
}: Props<T>) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-8"
      disabled={disabled}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="mb-8 text-body-sm-semibold text-text-default">
        {legend}
      </legend>
      {options.map((option, index) => {
        const hintId = option.hint ? `${id}-hint-${index}` : undefined;
        return (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-12 py-4"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-describedby={hintId}
              className="mt-2 size-20 shrink-0 cursor-pointer accent-surface-inverse focus-ring disabled:cursor-not-allowed"
            />
            <span className="flex min-w-0 flex-col gap-2">
              <span className="text-body-base-medium text-text-default">
                {option.label}
              </span>
              {option.hint ? (
                <span
                  id={hintId}
                  className="text-body-sm-regular text-text-muted"
                >
                  {option.hint}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-8 text-body-sm-regular text-text-error"
        >
          <Icon icon={WarningCircle} size="sm" weight="fill" className="mt-2" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
