import { InviteSkeleton } from "@/features/joining/components/InviteSkeleton";
import { JOIN_COPY } from "@/features/joining/copy";

// Board Joining-Confirm-loading (GC-009): skeletons with Join exchange and Not now disabled.
export default function JoinLoading() {
  return <InviteSkeleton actions={[{ label: JOIN_COPY.join }, { label: JOIN_COPY.notNow, variant: "text" }]} />;
}
