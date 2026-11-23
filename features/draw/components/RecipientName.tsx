"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadRecipient } from "../actions";
import { useDeviceHidden } from "../use-device-hidden";

type RecipientNameState = { name: string | null; failed: boolean };
const NameContext = createContext<RecipientNameState>({ name: null, failed: false });

type Props = {
  exchangeId: string;
  assignmentId: string;
  /** From the database: the giver has revealed at least once. Never the name. */
  revealedBefore: boolean;
  children: ReactNode;
};

// The person's name for the exchange page's pieces that show it (the "Who you're buying for" row and the revealed
// ActionCard in both placements). WHY one provider: each piece asking for the name would be its own Server Action call, three
// for one page. WHY a client component and a Server Action and never the page's HTML: the name must not be server-rendered
// (slice-10 AC-12). WHY null for a device that hid the person or a giver who has not revealed: nothing may show a name then.
export function RecipientNameProvider({ exchangeId, assignmentId, revealedBefore, children }: Props) {
  const device = useDeviceHidden(assignmentId);
  const [name, setName] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const load = revealedBefore && device === "shown";

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    loadRecipient(exchangeId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setName(result.recipient.displayName);
        else setFailed(true);
      })
      .catch(() => {
        // WHY: the pieces stay in their safe state (the row says "Hidden until you reveal it.", the card is not shown), and Reveal can try again.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [load, exchangeId]);

  // WHY in render: Hide again in this or another tab must drop the name before it is painted again.
  if (!load && name !== null) setName(null);
  if (!load && failed) setFailed(false);

  return <NameContext.Provider value={{ name: load ? name : null, failed: load && failed }}>{children}</NameContext.Provider>;
}

/** The person's name (null while loading, hidden on this device or not yet revealed), and whether the read failed. */
export function useRecipient(): RecipientNameState {
  return useContext(NameContext);
}
