import { EXCHANGE_COPY } from "../copy";

// Board Exchange-Detail-oclosed (m, d), UwCard block without a header: replaces "Share the invite link"
// once joining has closed (GCO-004, owner request 2026-11-14). No action until editing is built.
export function JoiningClosedCard() {
  const copy = EXCHANGE_COPY.detail;
  return (
    <section aria-labelledby="closed-heading" className="flex flex-col gap-12 rounded-2xl bg-surface-subtle p-24">
      <span className="text-body-sm-semibold text-text-muted">{copy.closedMeta}</span>
      <h2 id="closed-heading" className="text-heading-4">
        {copy.closedTitle}
      </h2>
      <p className="text-body-sm-regular text-text-secondary md:text-body-base-regular">{copy.closedBody}</p>
    </section>
  );
}
