import { Button } from "@/components/ui/Button";
import { REQUEST_COPY, UNAVAILABLE_COPY } from "../copy";
import { InviteFrame } from "./InviteFrame";

// "You've already asked" (GC-012, board Joining-Unavailable-pending): the viewer has a pending request.
// WHY the facts are only the exchange and the organiser's name: the same two the preview gives anyone.
export function RequestPending({ exchangeName, organiserFirstName }: { exchangeName: string; organiserFirstName: string }) {
  return (
    <InviteFrame
      footer={
        <Button fullWidth href="/home">
          {UNAVAILABLE_COPY.goToUnwrap}
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        <h1 className="text-heading-1">{REQUEST_COPY.alreadyAsked}</h1>
        <p className="break-words text-body-base-regular text-text-secondary">
          {REQUEST_COPY.pending(`'${exchangeName}'`, organiserFirstName)}
        </p>
      </div>
    </InviteFrame>
  );
}
