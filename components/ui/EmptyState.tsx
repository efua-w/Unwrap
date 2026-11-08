import type { ReactNode } from "react";
import { Icon, type PhosphorIcon } from "./Icon";

type Props = {
  title: string;
  body?: string;
  icon?: PhosphorIcon;
  /** The one next step, such as a Button. */
  action?: ReactNode;
  /** h1 when the state is the whole page (a list that isn't available), h2 inside a page. */
  headingLevel?: 1 | 2;
};

// Plan §4 "EmptyState": a quiet panel that says why there is nothing here and offers one next step.
// Boards: UwEmpty on Wishlist-List-first / -gone, and the "Add your first item" panel on
// Wishlist-Detail-newempty.
export function EmptyState({ title, body, icon, action, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section className="flex flex-col items-start gap-12 rounded-2xl bg-surface-subtle p-24">
      {icon ? <Icon icon={icon} size="lg" className="text-text-muted" /> : null}
      <Heading className={headingLevel === 1 ? "text-heading-3" : "text-heading-4"}>{title}</Heading>
      {body ? <p className="text-body-sm-regular text-text-secondary">{body}</p> : null}
      {action ? <div className="mt-4 flex w-full flex-col items-stretch md:w-auto md:items-start">{action}</div> : null}
    </section>
  );
}
