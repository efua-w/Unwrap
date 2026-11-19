import { cx } from "./cx";
import { initials } from "./initials";

// WHY: "face" is the small avatar in lists and stacks (36, 40 from 768); "row" is the 40 face of a person
// row on every width (board UwListItem kind "person"); "nav" is the 44 touch
// target in the header and sidebar; "profile" is the large one (80).
export type AvatarSize = "face" | "row" | "nav" | "profile";

const SIZE_CLASS: Record<AvatarSize, string> = {
  face: "size-avatar-sm md:size-40 text-body-sm-semibold",
  row: "size-40 text-body-xs-semibold",
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
  tone?: AvatarTone;
  className?: string;
};

export const AVATAR_BASE = "inline-flex shrink-0 items-center justify-center rounded-full border-2 text-text-default";

// WHY a tone: on a surface/subtle card the face is grey with a ring in the card's own colour (board UwAvatar stack,
// ring "#f7f7f7"), so overlapping faces read as separate. Anywhere else it is white with a light border.
export type AvatarTone = "default" | "on-subtle";
const TONE_CLASS: Record<AvatarTone, string> = {
  default: "border-border-default bg-surface-default",
  "on-subtle": "border-surface-subtle bg-surface-emphasis",
};

export function Avatar({ name, size = "face", decorative = false, tone = "default", className }: Props) {
  return (
    <span
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      className={cx(AVATAR_BASE, TONE_CLASS[tone], SIZE_CLASS[size], className)}
    >
      <span aria-hidden>{initials(name)}</span>
    </span>
  );
}
