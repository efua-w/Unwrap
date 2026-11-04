import { cx } from "./cx";

type TextSize = "xs" | "sm" | "base" | "lg";

// WHY: a skeleton line takes the line height of the text style it stands in for, so the layout
// does not jump when real content arrives (owner decision, slice 0a).
const TEXT_CLASS: Record<TextSize, string> = {
  xs: "text-body-xs-regular",
  sm: "text-body-sm-regular",
  base: "text-body-base-regular",
  lg: "text-body-lg-regular",
};

const PULSE = "animate-pulse motion-reduce:animate-none bg-surface-muted";

type Props =
  | { shape: "row"; className?: string }
  | { shape: "block"; className?: string }
  | { shape: "line"; text?: TextSize; className?: string };

export function Skeleton(props: Props) {
  if (props.shape === "line") {
    return (
      <div aria-hidden className={cx(TEXT_CLASS[props.text ?? "base"], props.className)}>
        <span className={cx("block h-lh rounded-lg", PULSE)} />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cx(PULSE, props.shape === "row" ? "min-h-row rounded-xl" : "min-h-textarea-min rounded-xl", props.className)}
    />
  );
}
