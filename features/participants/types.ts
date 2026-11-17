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

/** The asker's own pending request (Exchanges). WHY no request id: the row is not a control (AC-9). */
export type MyPendingRequest = {
  requestId: string;
  exchangeName: string;
  exchangeTint: ExchangeTint;
  organiserName: string;
  requestedAt: string;
};
