import type { ReactNode } from "react";
import { ExchangeTag } from "@/components/ui/ExchangeTag";

type Props = {
  name: string;
  tint: Parameters<typeof ExchangeTag>[0]["tint"];
  /** The two subtext lines under the title, as <p> elements. */
  children: ReactNode;
};

// Boards Exchange-Detail-*-d (avatar and title on one row) and -m (tag above the title). WHY one component:
// the organiser and participant headers must not drift apart. WHY `md` (plan §8: the only breakpoint, where the sidebar appears; owner, 2026-11-16): 768 shows the
// desktop header. The subtext sits outside the
// row so it starts under the avatar, not under the title. GC-013, GCO-004.
export function ExchangeDetailHeader({ name, tint, children }: Props) {
  return (
    <header className="flex flex-col items-start gap-4 md:gap-12">
      <div className="flex min-w-0 flex-col items-start gap-12 md:flex-row md:items-center">
        <ExchangeTag name={name} tint={tint} size="header" />
        <h1 className="min-w-0 break-words text-heading-2">{name}</h1>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </header>
  );
}
