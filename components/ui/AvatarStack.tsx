import { Avatar, type AvatarTone } from "./Avatar";
import { cx } from "./cx";

export const AVATAR_STACK_MAX = 5;

type Props = {
  people: ReadonlyArray<{ id: string; name: string }>;
  /** Dashed circles for people with nothing to show yet, such as no wishlist added. */
  missing?: number;
  /** One description for the whole stack, written by the caller. */
  label: string;
  /** "on-subtle" when the stack sits on a surface/subtle card (the readiness block). */
  tone?: AvatarTone;
  /** Most circles drawn, faces first. The readiness block raises it so every missing person gets a circle. */
  max?: number;
  className?: string;
};

export function AvatarStack({ people, missing = 0, label, tone = "default", max = AVATAR_STACK_MAX, className }: Props) {
  const shownPeople = people.slice(0, max);
  const shownMissing = Math.min(Math.max(0, missing), max - shownPeople.length);

  return (
    <div role="img" aria-label={label} className={cx("flex items-center", className)}>
      {shownPeople.map((p, i) => (
        <Avatar key={p.id} name={p.name} decorative tone={tone} className={cx(i > 0 && "-ml-6")} />
      ))}
      {Array.from({ length: shownMissing }, (_, i) => (
        <span
          key={`missing-${i}`}
          aria-hidden
          className={cx(
            "inline-flex size-avatar-sm shrink-0 rounded-full border-2 border-dashed border-border-placeholder md:size-40",
            tone === "default" && "bg-surface-default",
            shownPeople.length + i > 0 && "-ml-6",
          )}
        />
      ))}
    </div>
  );
}
