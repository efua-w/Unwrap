import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { cx } from "./cx";
import type { IconSize } from "./Icon";

const SIZE_CLASS: Record<IconSize, string> = { sm: "size-icon-sm", md: "size-icon-md", lg: "size-icon-lg" };

export function Spinner({ size = "md", className }: { size?: IconSize; className?: string }) {
  return (
    <CircleNotch
      aria-hidden
      className={cx("shrink-0 animate-spin motion-reduce:animate-none", SIZE_CLASS[size], className)}
    />
  );
}
