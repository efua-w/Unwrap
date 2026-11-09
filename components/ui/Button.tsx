import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ButtonControl } from "./ButtonControl";
import { cx } from "./cx";
import { Icon, type PhosphorIcon } from "./Icon";
import { Spinner } from "./Spinner";

export type ButtonVariant =
  | "primary"
  | "brand"
  | "secondary"
  | "destructive"
  | "text"
  | "destructive-text"
  | "link"
  | "back"
  | "icon";

type Base = {
  busy?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
};

type WithLabel = Base & {
  variant?: Exclude<ButtonVariant, "icon">;
  children: ReactNode;
  icon?: PhosphorIcon;
};

// WHY: an icon-only button has no text, so the type demands an accessible name (AC-12).
type IconOnly = Base & {
  variant: "icon";
  label: string;
  icon: PhosphorIcon;
  children?: never;
};

type AsLink = { href: string; type?: never; onClick?: never };
type AsButton = { href?: undefined } & Pick<
  ComponentPropsWithoutRef<"button">,
  "type" | "onClick" | "form" | "name" | "value" | "autoFocus" | "aria-expanded" | "aria-controls" | "aria-haspopup"
>;

export type ButtonProps = (WithLabel | IconOnly) & (AsLink | AsButton);

const PILL = "h-48 px-24 rounded-full gap-8 text-body-base-semibold";

const SHAPE: Record<ButtonVariant, string> = {
  primary: PILL,
  brand: PILL,
  secondary: PILL,
  destructive: PILL,
  text: PILL,
  "destructive-text": PILL,
  link: "min-h-touch-target rounded-lg gap-8 text-body-base-semibold",
  back: "min-h-touch-target pl-4 pr-12 rounded-full gap-4 text-body-sm-semibold",
  icon: "size-touch-target rounded-full",
};

const ENABLED: Record<ButtonVariant, string> = {
  primary: "bg-surface-inverse text-text-inverse hover:bg-surface-inverse-hover active:bg-surface-inverse-pressed",
  brand: "bg-surface-brand text-text-inverse hover:bg-surface-brand-hover active:bg-surface-brand-pressed",
  secondary:
    "border-1-5 border-border-emphasis text-text-default hover:bg-surface-secondary-hover active:bg-surface-secondary-pressed",
  destructive: "bg-surface-error text-text-inverse hover:bg-surface-error-hover active:bg-surface-error-pressed",
  text: "text-text-default hover:bg-surface-secondary-hover active:bg-surface-secondary-pressed",
  "destructive-text": "text-text-error hover:bg-surface-error-subtle active:bg-surface-error-subtle",
  link: "text-text-default underline decoration-dotted",
  back: "text-text-default hover:bg-surface-secondary-hover active:bg-surface-secondary-pressed",
  icon: "text-text-default hover:bg-surface-secondary-hover active:bg-surface-secondary-pressed",
};

const DISABLED: Record<ButtonVariant, string> = {
  primary: "bg-surface-disabled text-text-disabled cursor-not-allowed",
  brand: "bg-surface-disabled text-text-disabled cursor-not-allowed",
  destructive: "bg-surface-disabled text-text-disabled cursor-not-allowed",
  secondary: "border-1-5 border-surface-disabled text-text-disabled cursor-not-allowed",
  text: "text-text-disabled cursor-not-allowed",
  "destructive-text": "text-text-disabled cursor-not-allowed",
  link: "text-text-disabled underline decoration-dotted cursor-not-allowed",
  back: "text-text-disabled cursor-not-allowed",
  icon: "text-text-disabled cursor-not-allowed",
};

const BASE = "inline-flex items-center justify-center focus-ring";

// WHY: Button stays a Server Component so icons can be passed from other Server Components; the
// interactive element lives in ButtonControl, which swallows activation while busy (AC-12, R1-1).
export function Button(props: ButtonProps) {
  const variant: ButtonVariant = props.variant ?? "primary";
  const busy = props.busy === true;
  const disabled = props.disabled === true;
  const classes = cx(
    BASE,
    SHAPE[variant],
    disabled ? DISABLED[variant] : ENABLED[variant],
    props.fullWidth && "w-full",
    busy && "pointer-events-none",
    props.className,
  );

  const content =
    props.variant === "icon" ? (
      busy ? (
        <Spinner />
      ) : (
        <Icon icon={props.icon} />
      )
    ) : (
      <>
        {busy ? <Spinner /> : props.icon ? <Icon icon={props.icon} /> : null}
        {props.children}
      </>
    );
  const name = props.variant === "icon" ? props.label : undefined;

  if (props.href !== undefined) {
    if (disabled) {
      return (
        <span role="link" aria-disabled="true" aria-label={name} className={classes}>
          {content}
        </span>
      );
    }
    return (
      <ButtonControl href={props.href} busy={busy} ariaLabel={name} className={classes}>
        {content}
      </ButtonControl>
    );
  }

  return (
    <ButtonControl
      busy={busy}
      type={props.type ?? "button"}
      form={props.form}
      name={props.name}
      value={props.value}
      autoFocus={props.autoFocus}
      ariaLabel={name}
      ariaExpanded={props["aria-expanded"]}
      ariaControls={props["aria-controls"]}
      ariaHasPopup={props["aria-haspopup"]}
      disabled={disabled}
      onClick={props.onClick}
      className={classes}
    >
      {content}
    </ButtonControl>
  );
}
