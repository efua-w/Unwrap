import type { ReactNode } from "react";

// The three steps shared by Landing (GC-001) and Home's first-time state (GC-006). Copy is exact
// from boards Entry-Landing and HomeState-first.
const STEPS = [
  { title: "Start an exchange", body: "Give it a name, a budget and a day to swap gifts." },
  { title: "Share the link", body: "Send it on WhatsApp. People join and add a wishlist." },
  {
    title: "We draw names",
    body: "On the day, everyone finds out who they are buying for. Nobody sees who got whom.",
  },
] as const;

type Props = {
  /** Unique per page, because Landing and Home each label their own section. */
  headingId: string;
  /** Optional actions under the steps (Home shows two buttons). */
  children?: ReactNode;
};

export function HowItWorks({ headingId, children }: Props) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-20 rounded-2xl bg-surface-subtle p-24">
      <h2 id={headingId} className="text-heading-4">
        How Unwrap works
      </h2>
      <ol className="flex flex-col gap-16">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-16">
            <span
              aria-hidden
              className="flex size-40 shrink-0 items-center justify-center rounded-full bg-surface-default font-heading text-body-xl-bold"
            >
              {i + 1}
            </span>
            <span className="flex flex-col gap-2 pt-8">
              <strong className="text-body-base-semibold">{step.title}</strong>
              <span className="text-body-sm-regular text-text-secondary">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      {children ? <div className="flex flex-col gap-8">{children}</div> : null}
    </section>
  );
}
