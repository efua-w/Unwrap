import type { ReactNode } from "react";
import { cx } from "./cx";
import { countLabel } from "./count-label";
import { Icon, type PhosphorIcon } from "./Icon";

// WHY: always a <span>, never focusable or clickable. A Chip is a label, not a control.
// Height comes from the text line height plus padding, so no fixed size token is needed.
type Props =
  | { variant: "date" | "urgent" | "label" | "meta"; icon?: PhosphorIcon; children: ReactNode; className?: string }
  | { variant: "count"; count: number; className?: string };

const STYLE = {
  date: "bg-surface-muted text-text-default",
  urgent: "bg-surface-error-subtle text-text-error",
  label: "bg-surface-brand-muted text-text-default",
  meta: "bg-surface-subtle text-text-muted",
} as const;

export function Chip(props: Props) {
  if (props.variant === "count") {
    const label = countLabel(props.count);
    if (label === null) return null;
    return (
      <span
        className={cx(
          "inline-flex min-w-20 items-center justify-center rounded-full border-2 border-border-inverse bg-surface-brand px-4 text-body-xs-bold text-text-inverse",
          props.className,
        )}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex items-center gap-4 rounded-lg px-8 py-4 text-body-sm-semibold",
        STYLE[props.variant],
        props.className,
      )}
    >
      {props.icon ? <Icon icon={props.icon} size="sm" /> : null}
      {props.children}
    </span>
  );
}
