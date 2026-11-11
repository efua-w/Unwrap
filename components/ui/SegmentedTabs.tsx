"use client";

import Link from "next/link";
import { useId } from "react";
import { cx } from "./cx";

const TRACK = "box-border flex gap-4 rounded-full bg-surface-muted p-4";
const PILL =
  "flex min-h-touch-target flex-1 items-center justify-center rounded-full border-1 px-20";
const ON = "border-border-default bg-surface-default text-body-sm-semibold text-text-default";
const OFF = "border-transparent text-body-sm-medium text-text-secondary";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> =
  | {
      // A choice kept in a form (When are names drawn?). Native radios: arrow keys and the group name come free.
      kind: "choice";
      legend: string;
      name: string;
      options: readonly Option<T>[];
      value: T;
      onChange: (value: T) => void;
      disabled?: boolean;
      // Inline switch beside a field (Draw time AM/PM): shrinks to its options and keeps the legend
      // as the group's accessible name only, not on screen.
      compact?: boolean;
    }
  | {
      // Two views of one page (Active / Past): each is a link, the current one is marked.
      kind: "links";
      label: string;
      items: ReadonlyArray<{ label: string; href: string; current: boolean }>;
    };

// Boards: UwTabs (Active/Past on Exchanges, "When are names drawn?" on Budget and dates).
export function SegmentedTabs<T extends string>(props: Props<T>) {
  const id = useId();
  if (props.kind === "links") {
    return (
      <nav aria-label={props.label} className={cx(TRACK, "md:self-start")}>
        {props.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            replace
            aria-current={item.current ? "page" : undefined}
            className={cx(PILL, "focus-ring", item.current ? ON : OFF)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <fieldset className="min-w-0" disabled={props.disabled}>
      <legend className={props.compact ? "sr-only" : "mb-8 text-body-sm-semibold text-text-default"}>{props.legend}</legend>
      <div className={cx(TRACK, props.compact && "w-fit")}>
        {props.options.map((option, i) => (
          <label
            key={option.value}
            className={cx(
              PILL,
              props.compact && "min-w-64 flex-none",
              "cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-focus",
              props.value === option.value ? ON : OFF,
              "has-disabled:cursor-not-allowed has-disabled:text-text-disabled",
            )}
          >
            <input
              id={`${id}-${i}`}
              type="radio"
              name={props.name}
              value={option.value}
              checked={props.value === option.value}
              onChange={() => props.onChange(option.value)}
              className="sr-only focus-ring"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
