import type { ExchangeTint } from "@/components/ui/ExchangeTag";

// What the participants screens may carry (GCO-007, GC-012). WHY ids are the request and member ids only:
// the organiser never reads a user id, an email, an avatar path or a list status, and a component cannot
// be handed what the type has no field for (AC-12, AC-17, AC-41).

/** A pending request as the organiser reads it. `askedLabel` is already in the viewer's zone. */
export type JoinRequestLine = { requestId: string; name: string; askedLabel: string };

/** A pending request, before its time becomes a label. */
export type JoinRequestRow = { requestId: string; name: string; requestedAt: string };

/** One person taking part, as Participants lists them. */
export type ParticipantLine = { memberId: string; name: string; isMe: boolean; isOrganiser: boolean };

/** The asker's own pending request (Exchanges). WHY no request id: the row is not a control (AC-9). */
export type MyPendingRequest = {
  requestId: string;
  exchangeName: string;
  exchangeTint: ExchangeTint;
  organiserName: string;
  requestedAt: string;
};
