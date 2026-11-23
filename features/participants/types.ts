import type { ExchangeTint } from "@/components/ui/ExchangeTag";

// What the participants screens may carry (GCO-007, GC-012). WHY ids are the request and member ids only:
// the organiser never reads a user id or an avatar path, and a component cannot be handed what the type has
// no field for (AC-12, AC-17, AC-41). The organiser may read an email (owner decision 2026-11-15), but only
// the two Participants-only types below have a field for it: the names-only `JoinRequestRow` that the
// exchange page and Exchanges use has none, and no member-facing type may ever gain one.

/** A pending request as the organiser reads it on Participants. `askedLabel` is already in the viewer's zone. */
export type JoinRequestLine = { requestId: string; name: string; email: string; askedLabel: string };

/** A pending request, before its time becomes a label. Names only: for the exchange page and Exchanges. */
export type JoinRequestRow = { requestId: string; name: string; requestedAt: string };

/** A pending request with the requester's address. Participants only (GCO-007). */
export type JoinRequestRowWithEmail = JoinRequestRow & { email: string };

/**
 * One person taking part, as the organiser's Participants lists them. `email` is null on the organiser's own
 * row. `hasWishlist` only says a list is attached: never its items or reservations (owner Q1, 2026-11-16).
 */
export type ParticipantLine = {
  memberId: string;
  name: string;
  email: string | null;
  hasWishlist: boolean;
  isMe: boolean;
  isOrganiser: boolean;
};

/** The asker's own request (Exchanges). WHY a request id: Dismiss on a closed request needs it (GC-006); a pending row is not a control (AC-9). */
export type MyPendingRequest = {
  requestId: string;
  /** pending: still waiting. closed: the draw happened first (GC-006), shown until dismissed. */
  status: "pending" | "closed";
  exchangeName: string;
  exchangeTint: ExchangeTint;
  organiserName: string;
  requestedAt: string;
};

/**
 * One person taking part, as the organiser's readiness reads them (GCO-006). `memberId` is the membership row's id, not
 * a person id. WHY no email and no list name: readiness is yes or no, so a card cannot print what its type lacks.
 */
export type ReadinessRow = {
  memberId: string;
  name: string;
  isMe: boolean;
  hasWishlist: boolean;
  /** Nudged by anyone in the last 12 hours: a new nudge would skip them (GCO-008). */
  nudgedRecently: boolean;
};

/** A person a nudge would go to. */
export type NudgeTarget = { memberId: string; name: string };
