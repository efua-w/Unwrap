"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { Icon } from "@/components/ui/Icon";
import { cardState, dismissCard, resetCard, subscribeCards } from "../card-dismiss";
import { deviceStore, type DeviceHidden } from "../storage";
import { DRAW_COPY } from "../copy";

function useCardState(cardKey: string): DeviceHidden {
  return useSyncExternalStore<DeviceHidden>(
    subscribeCards,
    () => cardState(cardKey),
    () => "pending",
  );
}

// Wraps an ActionCard so a device that dismissed it shows nothing. WHY "pending" keeps the card but invisible: the server
// render and hydration cannot know the device's answer, and an invisible card holds its space, so a card that was never
// dismissed does not jump in and a dismissed one never flashes. `contents` adds no box; `invisible` is inherited, so the
// card is out of the focus order until the answer is known. Both placements of one card share the key, so both go.
export function CardGate({ cardKey, children }: { cardKey: string; children: ReactNode }) {
  const state = useCardState(cardKey);
  if (state === "hidden") return null;
  return <div className={state === "pending" ? "contents invisible" : "contents"}>{children}</div>;
}

// The close control at the far right of the banner (a sibling of the action, never inside it).
export function CardDismissButton({ cardKey }: { cardKey: string }) {
  return (
    <button
      type="button"
      onClick={() => dismissCard(deviceStore(), cardKey)}
      className="flex size-touch-target shrink-0 cursor-pointer items-center justify-center rounded-full text-text-secondary hover:bg-surface-brand-muted focus-ring"
    >
      <Icon icon={X} size="md" />
      <span className="sr-only">{DRAW_COPY.dismissCard}</span>
    </button>
  );
}

// Renders nothing. Put it where the card's condition has gone (the wishlist exists, the name was revealed) so an old Dismiss
// cannot hide a later card for the same subject.
export function CardReset({ cardKey }: { cardKey: string }) {
  useEffect(() => {
    resetCard(deviceStore(), cardKey);
  }, [cardKey]);
  return null;
}
