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
  /** "2026-12-12": a date only, in the organiser's zone, shown as stored to every viewer. */
  giftDay: string;
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
  /** When the viewer joined (their own membership row). Used for "You joined today." */
  joinedAt: string;
  /** Cancelled or completed: moves to the Past tab. */
  isPast: boolean;
};

// One person in the People section: a first-person-safe name and two flags. WHY no id, email or list
// status: the section shows faces and names only, to every member (GC-013, pair secrecy).
export type PersonLine = { name: string; isOrganiser: boolean; isMe: boolean };

// The viewer's own list in this exchange, as the exchange page shows it (GC-013, GCO-004 S49). The
// function answers about the caller only.
export type OwnListSummary = { source: "none" | "wishlist" | "ideas" | "kept"; name: string | null; itemCount: number };

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
  people: PersonLine[];
  /** Null when the organiser is just organising. */
  myList: OwnListSummary | null;
};

// The participant's view of one exchange before the draw (GC-013). WHY no token, emails, user ids or
// anyone else's list status: a member may not read them (plan inv. 8, AC-20..22, AC-24). The only list
// here is the viewer's own.
export type MemberExchange = Schedule & {
  id: string;
  name: string;
  note: string | null;
  budget: BudgetPreset;
  tint: ExchangeTint;
  organiserName: string;
  people: PersonLine[];
  myList: OwnListSummary;
};
