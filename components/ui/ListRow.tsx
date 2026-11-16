import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

type Target =
  | { href: string; external?: boolean; onClick?: never; disabled?: never }
  | { href?: never; external?: never; onClick: () => void; disabled?: boolean }
  // A row that only displays (a public wishlist item with no link): not a control at all.
  | { href?: never; external?: never; onClick?: never; disabled?: never };

type Props = Target & {
  title: string;
  /** A decorative mark before the title, such as an ExchangeTag. */
  leading?: ReactNode;
  /** One supporting line under the title, such as "4 items · updated today". WHY it wraps and is not clamped: an email address must show whole (owner Q6). */
  sub?: string;
  /** A third line under `sub`, such as the owner's note on a shared wishlist item. */
  note?: string;
  /** Non-interactive label at the end of the target, such as a who-can-see chip. */
  meta?: ReactNode;
  /** A trailing control (such as the bin). Rendered as a sibling of the target, never inside it. */
  action?: ReactNode;
  /** A line above the row, between rows. */
  divider?: boolean;
  /** Lets the parent find the row's main target, such as to move focus after a removal. */
  rowId?: string;
  /** Regular instead of semibold title: a row already seen (board UwListItem kind "activity", read). */
  quiet?: boolean;
};

// Plan §4 "ListRow": the whole row is one target (a link, or a button that opens a sheet), and a
// trailing action is a separate sibling target (CLAUDE.md: a button can't contain a button).
// `external` opens a shop link in a new tab. WHY nofollow ugc: the link is whatever a stranger typed
// (GC-023), so it must not pass on trust or leak the shared page's address.
export function ListRow({ title, leading, sub, note, meta, action, divider = false, rowId, quiet = false, ...target }: Props) {
  const body = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className={cx("break-words text-text-default", quiet ? "text-body-base-regular" : "text-body-base-semibold")}>{title}</span>
        {sub ? <span className="break-words text-body-sm-regular text-text-muted">{sub}</span> : null}
        {note ? <span className="line-clamp-2 break-words text-body-sm-regular text-text-secondary">{note}</span> : null}
      </span>
      {meta ? <span className="shrink-0">{meta}</span> : null}
    </>
  );
  const targetClass =
    "flex min-h-row min-w-0 flex-1 items-center gap-12 rounded-lg py-12 text-left focus-ring disabled:cursor-not-allowed";

  return (
    <li data-row-id={rowId} className={cx("flex items-center gap-8", divider && "border-t-1 border-border-subtle")}>
      {target.href !== undefined && target.external ? (
        <a href={target.href} target="_blank" rel="noopener noreferrer nofollow ugc" className={targetClass}>
          {body}
        </a>
      ) : target.href !== undefined ? (
        <Link href={target.href} className={targetClass}>
          {body}
        </Link>
      ) : target.onClick === undefined ? (
        <div className="flex min-h-row min-w-0 flex-1 items-center gap-12 py-12">{body}</div>
      ) : (
        <button type="button" onClick={target.onClick} disabled={target.disabled} className={targetClass}>
          {body}
        </button>
      )}
      {action ? <span className="shrink-0">{action}</span> : null}
    </li>
  );
}
