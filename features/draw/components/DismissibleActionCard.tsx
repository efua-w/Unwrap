import type { ComponentProps } from "react";
import { ActionCard } from "@/components/ui/ActionCard";
import { CardDismissButton, CardGate } from "./CardDismiss";

type Props = Omit<ComponentProps<typeof ActionCard>, "dismiss"> & {
  /** From cardKey(): the kind and the id the person already sees. */
  cardKey: string;
};

// An ActionCard a device can dismiss. A server component on purpose: the icon is a component reference, which cannot cross
// into a client component, so only the gate and the button are client code. Both placements get the same key, so one
// Dismiss hides both; only the banner carries the control.
export function DismissibleActionCard({ cardKey, ...card }: Props) {
  return (
    <CardGate cardKey={cardKey}>
      <ActionCard {...card} dismiss={card.placement === "banner" ? <CardDismissButton cardKey={cardKey} /> : undefined} />
    </CardGate>
  );
}
