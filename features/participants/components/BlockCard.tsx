import type { ReactNode } from "react";

type Props = {
  headingId: string;
  /** Set on Exchanges, where the card names its exchange: the tag and name sit above the headline. */
  header?: ReactNode;
  /** The small grey line above the headline. Left out when `header` carries the meta. */
  meta?: string;
  title: string;
  /** The face row between headline and body (readiness only). */
  faces?: ReactNode;
  body: string;
  /** One button or link, at its natural width. */
  action: ReactNode;
};

// The "needs you" block card (board UwCard kind "block": surface/subtle, radius 16, padding 24, gap 20; headline 18,
// 24 from 768; body 14, 16 from 768; one secondary action). WHY one component: the join-request card and the
// readiness card are the same UwCard, so a change to its look is made once.
export function BlockCard({ headingId, header, meta, title, faces, body, action }: Props) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-20 rounded-2xl bg-surface-subtle p-24">
      {header}
      <div className="flex flex-col gap-12">
        {meta ? <span className="text-body-sm-semibold text-text-muted">{meta}</span> : null}
        <h2 id={headingId} className="break-words text-heading-4">
          {title}
        </h2>
        {faces}
        <p className="break-words text-body-sm-regular text-text-secondary md:text-body-base-regular">{body}</p>
      </div>
      <div>{action}</div>
    </section>
  );
}
