import type { ExchangeTint } from "@/components/ui/ExchangeTag";
import type { BudgetPreset } from "@/lib/money/budget";

// WHY these types and no more (core security rule, GC-002, GC-009): the signed-out preview has no field
// for a person other than the inviter, an id, the token, the note or an email. The join view has names
// only (no ids, no emails, no list status). A component cannot receive what the type cannot hold.

export type InviteStatus = "open" | "closed" | "cancelled" | "full" | "approval";

/** get_invite_preview (GC-002): everything a signed-out visitor may learn from the link. */
export type InvitePreview = {
  status: InviteStatus;
  exchangeName: string;
  tint: ExchangeTint;
  inviterName: string;
  budget: BudgetPreset;
  /** ISO instant. */
  joinByAt: string;
  /** "2026-12-24": a date only, shown as stored. */
  giftDay: string;
  /** Active members other than the organiser. */
  joinedCount: number;
  /** When joining closed. Set only for "closed". */
  closedAt: string | null;
  /** Set only for "cancelled". */
  cancelledAt: string | null;
  drawMode: "at_join_by" | "organiser_chooses";
  /** ISO instant; null when the organiser draws. */
  drawAt: string | null;
};

export type JoinViewer = "member" | "can_join" | "removed";

export type JoinPerson = { name: string; isOrganiser: boolean };

/** get_join_details (GC-009). `exchangeId` is set only for an active member. */
export type JoinDetails = {
  status: InviteStatus;
  viewer: JoinViewer;
  exchangeId: string | null;
  exchangeName: string;
  tint: ExchangeTint;
  organiserName: string;
  budget: BudgetPreset;
  joinByAt: string;
  drawMode: "at_join_by" | "organiser_chooses";
  /** Null when the organiser draws names themselves. */
  drawAt: string | null;
  giftDay: string;
  note: string | null;
  people: JoinPerson[];
};

/** Why an invite page shows "This invite can't be used" (S13). */
export type UnavailableKind = "incorrect" | InviteStatus | "removed";
