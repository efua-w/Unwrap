import { Lock, WarningCircle, WifiSlash } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type PhosphorIcon } from "./Icon";

export type AlertVariant = "offline" | "error" | "privacy";

type VariantStyle = {
  box: string;
  icon: PhosphorIcon;
  iconClass: string;
  role: "status" | "alert" | undefined;
};

// WHY: text/pending is low contrast on its own (plan §8), so the offline Alert always pairs its
// icon with a text message. The privacy note is static, so it has no live role. The offline Alert has none either: OfflineBanner owns the always-mounted live region it sits in (R1-6).
const VARIANTS: Record<AlertVariant, VariantStyle> = {
  offline: { box: "bg-surface-pending-subtle", icon: WifiSlash, iconClass: "text-text-pending", role: undefined },
  error: { box: "bg-surface-error-subtle", icon: WarningCircle, iconClass: "text-text-error", role: "alert" },
  privacy: { box: "bg-surface-subtle", icon: Lock, iconClass: "text-text-muted", role: undefined },
};

type Props = {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  /** Optional action, such as a Try again button. */
  action?: ReactNode;
  className?: string;
};

export function Alert({ variant, title, children, action, className }: Props) {
  const v = VARIANTS[variant];
  return (
    <div role={v.role} className={cx("flex items-start gap-12 rounded-xl p-16", v.box, className)}>
      <Icon icon={v.icon} weight={variant === "error" ? "fill" : "regular"} className={cx("mt-2", v.iconClass)} />
      <div className={cx("flex min-w-0 flex-1 flex-col gap-4", variant === "privacy" ? "text-text-muted" : "text-text-default")}>
        {title ? <p className="text-body-base-semibold">{title}</p> : null}
        <div className="text-body-sm-regular">{children}</div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
