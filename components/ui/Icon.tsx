import type { HouseIcon } from "@phosphor-icons/react/dist/ssr";
import { cx } from "./cx";

export type PhosphorIcon = typeof HouseIcon;
export type IconSize = "sm" | "md" | "lg";
export type IconWeight = "regular" | "fill" | "bold";

const SIZE_CLASS: Record<IconSize, string> = {
  sm: "size-icon-sm",
  md: "size-icon-md",
  lg: "size-icon-lg",
};

type Props = {
  icon: PhosphorIcon;
  size?: IconSize;
  weight?: IconWeight;
  /** Omit when the icon sits beside text that says the same thing; the icon is then hidden from screen readers. */
  label?: string;
  className?: string;
};

export function Icon({ icon: Glyph, size = "md", weight = "regular", label, className }: Props) {
  return (
    <Glyph
      weight={weight}
      className={cx("shrink-0", SIZE_CLASS[size], className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
