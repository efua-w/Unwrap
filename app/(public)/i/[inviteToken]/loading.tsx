import { InviteSkeleton } from "@/features/joining/components/InviteSkeleton";
import { INVITE_COPY } from "@/features/joining/copy";

// Board Join-Exchange-loading (GC-002): skeletons and a disabled Join exchange.
export default function InviteLoading() {
  return <InviteSkeleton actions={[{ label: INVITE_COPY.join }]} />;
}
