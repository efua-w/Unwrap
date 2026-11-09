import type { ExchangeTint } from "@/components/ui/ExchangeTag";
import type { BudgetPreset } from "@/lib/money/budget";
import type { DrawMode } from "@/lib/validation/exchange";

export type { DrawMode, ExchangeTint };

// The moments of an exchange, as stored (ISO strings). Enough to write every timeline line.
export type Schedule = {
  joinByAt: string;
  drawMode: DrawMode;
  /** Null when the organiser draws names themselves ("When I choose"). */
  drawAt: string | null;
  eventAt: string;
  approvalRequired: boolean;
};

// One row of Exchanges (GC-008). No invite token, no emails, no other member's data: a count only.
export type ExchangeListItem = Schedule & {
  id: string;
  name: string;
  tint: ExchangeTint;
  /** True when the viewer started it. */
  isOrganiser: boolean;
  /** False when the viewer organises without taking part. */
  takingPart: boolean;
  /** People in, the viewer included. */
  peopleCount: number;
  createdAt: string;
  /** Cancelled or completed: moves to the Past tab. */
  isPast: boolean;
};

// The organiser's view of one exchange (GC-013 just started). WHY no token here: the invite token
// travels beside it, to the organiser's invite section only (GCO-004).
export type OrganiserExchange = Schedule & {
  id: string;
  name: string;
  note: string | null;
  budget: BudgetPreset;
  tint: ExchangeTint;
  takingPart: boolean;
  peopleCount: number;
  createdAt: string;
  /** Calculated status (open, joining_closed, ...). Only "open" has a link worth sharing. */
  isOpen: boolean;
};
