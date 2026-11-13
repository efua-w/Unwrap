export type TimelineStep = { title: string; detail: string };

// Boards: the "What happens next" list on Exchange-Detail-started (numbered steps, title + one line).
// The numbers are decoration: an <ol> already announces the order.
export function Timeline({ steps }: { steps: readonly TimelineStep[] }) {
  return (
    <ol className="flex flex-col gap-16">
      {steps.map((step, i) => (
        <li key={step.title} className="flex items-start gap-16">
          <span
            aria-hidden
            className="flex size-40 shrink-0 items-center justify-center rounded-full bg-surface-default font-heading text-body-xl-bold"
          >
            {i + 1}
          </span>
          <span className="flex min-w-0 flex-col gap-2 pt-8">
            <strong className="text-body-base-semibold">{step.title}</strong>
            <span className="text-body-sm-regular text-text-secondary">{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
