import type { Database } from "@/lib/supabase/database.types";
import type { JoinRequestRow, JoinRequestRowWithEmail, ParticipantLine } from "./types";

// Pure mappers from the database rows to the screens' types (GCO-007). WHY apart from queries.ts: they hold the
// rules about the address, so a unit test can pin them without a database.
type Fns = Database["public"]["Functions"];
type RequestRecord = Fns["get_join_requests"]["Returns"][number];
type ParticipantRecord = Fns["get_participants"]["Returns"][number];

// Names only: the address the function returns is dropped, so the exchange page and Exchanges never carry it.
export function toJoinRequestRow(r: RequestRecord): JoinRequestRow {
  return { requestId: r.request_id, name: r.display_name, requestedAt: r.requested_at };
}

// Participants only.
export function toJoinRequestRowWithEmail(r: RequestRecord): JoinRequestRowWithEmail {
  return { ...toJoinRequestRow(r), email: r.email };
}

// WHY ?? null: the database leaves the organiser's own row empty, though the generated type says string.
export function toParticipantLine(p: ParticipantRecord): ParticipantLine {
  return {
    memberId: p.member_id,
    name: p.display_name,
    email: (p.email as string | null) ?? null,
    hasWishlist: p.has_wishlist,
    isMe: p.is_me,
    isOrganiser: p.is_organiser,
  };
}
