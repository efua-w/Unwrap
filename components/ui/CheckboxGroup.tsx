import { useId } from "react";

export type CheckboxOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

type Props<T extends string> = {
  legend: string;
  options: readonly CheckboxOption<T>[];
  /** The values that are ticked. */
  checked: readonly T[];
  onChange: (value: T, checked: boolean) => void;
  disabled?: boolean;
};

// Board UwRadio kind "check". WHY native checkboxes in a fieldset: Space toggles, the group name is read
// with each option, and `disabled` on the fieldset covers the saving and offline states of the boards.
export function CheckboxGroup<T extends string>({ legend, options, checked, onChange, disabled = false }: Props<T>) {
  const id = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-8" disabled={disabled}>
      <legend className="mb-8 text-body-sm-semibold text-text-default">{legend}</legend>
      {options.map((option, index) => {
        const hintId = option.hint ? `${id}-hint-${index}` : undefined;
        return (
          <label key={option.value} className="flex cursor-pointer items-start gap-12 py-4">
            <input
              type="checkbox"
              value={option.value}
              checked={checked.includes(option.value)}
              onChange={(event) => onChange(option.value, event.target.checked)}
              aria-describedby={hintId}
              className="mt-2 size-20 shrink-0 cursor-pointer accent-surface-inverse focus-ring disabled:cursor-not-allowed"
            />
            <span className="flex min-w-0 flex-col gap-2">
              <span className="text-body-base-medium text-text-default">{option.label}</span>
              {option.hint ? (
                <span id={hintId} className="text-body-sm-regular text-text-muted">
                  {option.hint}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
