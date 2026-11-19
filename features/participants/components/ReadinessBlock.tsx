"use client";

import { useState } from "react";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Button } from "@/components/ui/Button";
import { firstName } from "@/features/joining/copy";
import { NUDGE_COPY } from "../copy";
import { waitingNames } from "../format";
import type { NudgeTarget } from "../types";
import { BlockCard } from "./BlockCard";
import { NudgeSheet } from "./NudgeSheet";

// Most circles in the face row: a 390 card holds about nine at 36 with the 6 overlap.
const FACES_MAX = 8;

type Props = {
  exchangeId: string;
  exchangeName: string;
  organiserFirst: string;
  /** "Fri 27 Nov" for an automatic draw, in the viewer's zone. Null when the organiser draws names themselves. */
  drawDay: string | null;
  /** Names of the people whose wishlist is in, for the face row: initials only, no list. */
  inNames: readonly string[];
  inCount: number;
  total: number;
  /** Everyone else with no wishlist yet, nudged recently or not. At least one. */
  missingNames: readonly string[];
  /** The ones a nudge would reach now. */
  targets: readonly NudgeTarget[];
};

// GCO-006 readiness block (boards Exchange-Detail-obefore, -ojust: "Needs you by {day}" / "5 of 8 wishlists are in" /
// who is missing / "Nudge 3 people…"), with the Nudge sheet (S32). WHY a block and not avatars: the owner decided
// 2026-11-18 that readiness is this card. WHY names only: the organiser reads a yes or no and first names, never a
// list or its items (GCO-006). The button opens a dialog, so it carries aria-haspopup like the other sheet openers.
export function ReadinessBlock({ exchangeId, exchangeName, organiserFirst, drawDay, inNames, inCount, total, missingNames, targets }: Props) {
  const copy = NUDGE_COPY;
  const [open, setOpen] = useState(false);
  const [only] = missingNames;
  const single = missingNames.length === 1 && only !== undefined;
  const headingId = `readiness-${exchangeId}`;
  // WHY the targets when there are any: the button promises who the sheet will nudge. Everyone nudged lately still
  // opens the sheet, which says so (board Org-Nudge-recent).
  const [firstTarget] = targets;
  const buttonCount = targets.length > 0 ? targets.length : missingNames.length;
  const buttonFirst = firstName((targets.length > 0 ? firstTarget?.name : only) ?? "");
  return (
    <>
      <BlockCard
        headingId={headingId}
        meta={drawDay ? copy.cardMeta(drawDay) : copy.cardMetaManual}
        title={copy.cardTitle(inCount, total)}
        faces={
          <AvatarStack
            tone="on-subtle"
            max={FACES_MAX}
            // WHY the slice: every missing person keeps a dashed circle, so the faces give way first.
            people={inNames.slice(0, Math.max(0, FACES_MAX - missingNames.length)).map((name, i) => ({ id: String(i), name }))}
            missing={missingNames.length}
            label={copy.facesLabel(inCount, missingNames.length)}
          />
        }
        body={single ? copy.cardBodyOne(firstName(only)) : copy.cardBodyMany(waitingNames(missingNames))}
        action={
          <Button variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            {copy.cardAction(buttonCount, buttonFirst)}
          </Button>
        }
      />
      <NudgeSheet
        open={open}
        onClose={() => setOpen(false)}
        exchangeId={exchangeId}
        exchangeName={exchangeName}
        organiserFirst={organiserFirst}
        drawDay={drawDay}
        targets={targets}
      />
    </>
  );
}
