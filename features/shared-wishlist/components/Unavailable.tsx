import { Button } from "@/components/ui/Button";
import { SHARED_COPY } from "../copy";
import { SharedFrame } from "./SharedFrame";

// GC-023: one answer for a private, deleted or unknown list, and for a malformed link. It never says
// which, and never mentions turning off the link. Board: Wishlist-Shared-unavailable.
export function Unavailable() {
  return (
    <SharedFrame>
      <div className="flex flex-col gap-8">
        <h1 className="text-heading-1">{SHARED_COPY.unavailableTitle}</h1>
        <p className="text-body-base-regular text-text-secondary">{SHARED_COPY.unavailableBody}</p>
      </div>
      <Button variant="secondary" href="/signup" fullWidth className="md:w-auto md:self-start">
        {SHARED_COPY.makeYourOwn}
      </Button>
    </SharedFrame>
  );
}
