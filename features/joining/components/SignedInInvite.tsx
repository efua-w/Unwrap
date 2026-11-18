import { formatDay } from "@/lib/dates/format";
import type { MyProfile } from "@/lib/auth/session";
import { REQUEST_COPY, firstName, unavailableBody } from "../copy";
import { getMyEmail } from "../queries";
import type { InviteView } from "../status";
import type { JoinDetails } from "../types";
import { AskToJoin } from "./AskToJoin";
import { JoinBySummary } from "./JoinBySummary";
import { JoinContent } from "./JoinContent";
import { JoinForm } from "./JoinForm";
import { RequestPending } from "./RequestPending";

export type SignedInView = Exclude<InviteView["view"], "member" | "unavailable">;

// The signed-in side of the one invite screen (GC-009, GC-012; boards Join-Exchange-default, -alone,
// -approval; Joining-Unavailable-closed, -asking, -pending). Every action happens in place on /i/<token>.
// `autoStart` is set only by the post-sign-in action page, which has already checked the join intent.
// WHY the facts come from get_join_details and nothing else: it holds names only, no ids, no emails.
export async function SignedInInvite({
  token,
  view,
  details,
  closedAt = null,
  profile,
  timeZone,
  autoStart = false,
}: {
  token: string;
  view: SignedInView;
  details: JoinDetails;
  /** The moment joining closed, from the public preview (for the closed line). */
  closedAt?: string | null;
  profile: Pick<MyProfile, "displayName">;
  timeZone: string;
  autoStart?: boolean;
}) {
  const organiser = firstName(details.organiserName);

  switch (view) {
    case "pending":
      return <RequestPending exchangeName={details.exchangeName} organiserFirstName={organiser} />;
    case "ask-closed": {
      const body = unavailableBody("closed", {
        who: details.organiserName,
        exchangeName: details.exchangeName,
        day: closedAt ? formatDay(new Date(closedAt), timeZone) : null,
      });
      return (
        <AskToJoin token={token} variant="closed" exchangeName={details.exchangeName} organiserFirstName={organiser} body={body} />
      );
    }
    case "ask-removed":
      // GC-012 Q5: no names, no way to join directly, only a request.
      return (
        <AskToJoin
          token={token}
          variant="removed"
          exchangeName={details.exchangeName}
          organiserFirstName={organiser}
          body={REQUEST_COPY.removed(`'${details.exchangeName}'`)}
        />
      );
    case "join":
    case "ask-confirm": {
      const email = await getMyEmail();
      const content = (
        <JoinContent
          timeZone={timeZone}
          facts={{
            exchangeName: details.exchangeName,
            tint: details.tint,
            organiserName: details.organiserName,
            budget: details.budget,
            joinByAt: details.joinByAt,
            drawMode: details.drawMode,
            drawAt: details.drawAt,
            giftDay: details.giftDay,
          }}
          audience={{
            kind: "signed-in",
            people: details.people,
            note: details.note,
            viewerName: profile.displayName,
            viewerEmail: email,
          }}
        />
      );
      if (view === "join") {
        return (
          <JoinForm token={token} exchangeName={details.exchangeName} autoStart={autoStart}>
            {content}
          </JoinForm>
        );
      }
      // GC-012: an approval exchange shows the same screen, and the action sends a request.
      return (
        <AskToJoin
          token={token}
          variant="confirm"
          exchangeName={details.exchangeName}
          organiserFirstName={organiser}
          sentRows={<JoinBySummary details={details} timeZone={timeZone} />}
          autoStart={autoStart}
        >
          {content}
        </AskToJoin>
      );
    }
  }
}
