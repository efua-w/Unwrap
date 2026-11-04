import { Avatar } from "./Avatar";
import { cx } from "./cx";

export const AVATAR_STACK_MAX = 5;

type Props = {
  people: ReadonlyArray<{ id: string; name: string }>;
  /** Dashed circles for people with nothing to show yet, such as no wishlist added. */
  missing?: number;
  /** One description for the whole stack, written by the caller. */
  label: string;
  className?: string;
};

export function AvatarStack({ people, missing = 0, label, className }: Props) {
  const shownPeople = people.slice(0, AVATAR_STACK_MAX);
  const shownMissing = Math.min(Math.max(0, missing), AVATAR_STACK_MAX - shownPeople.length);

  return (
    <div role="img" aria-label={label} className={cx("flex items-center", className)}>
      {shownPeople.map((p, i) => (
        <Avatar key={p.id} name={p.name} decorative className={cx(i > 0 && "-ml-6")} />
      ))}
      {Array.from({ length: shownMissing }, (_, i) => (
        <span
          key={`missing-${i}`}
          aria-hidden
          className={cx(
            "inline-flex size-avatar-sm shrink-0 rounded-full border-2 border-dashed border-border-placeholder bg-surface-default md:size-40",
            shownPeople.length + i > 0 && "-ml-6",
          )}
        />
      ))}
    </div>
  );
}
