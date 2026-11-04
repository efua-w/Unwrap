import { cx } from "./cx";
import { initials } from "./initials";

// WHY: "face" is the small avatar in lists and stacks (36, 40 from 768); "nav" is the 44 touch
// target in the header and sidebar; "profile" is the large one (80).
export type AvatarSize = "face" | "nav" | "profile";

const SIZE_CLASS: Record<AvatarSize, string> = {
  face: "size-avatar-sm md:size-40 text-body-sm-semibold",
  nav: "size-touch-target text-body-sm-semibold",
  profile: "size-80 text-body-2xl-semibold",
};

// WHY: people only ever carry a name here. No email field exists, so an email cannot reach
// an avatar by mistake (organiser never sees emails).
type Props = {
  name: string;
  size?: AvatarSize;
  /** True when the person's name is shown next to the avatar, so screen readers skip it. */
  decorative?: boolean;
  className?: string;
};

export const AVATAR_BASE = "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-border-default bg-surface-default text-text-default";

export function Avatar({ name, size = "face", decorative = false, className }: Props) {
  return (
    <span
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      className={cx(AVATAR_BASE, SIZE_CLASS[size], className)}
    >
      <span aria-hidden>{initials(name)}</span>
    </span>
  );
}
