"use client";

import { Button } from "./Button";
import { useToast } from "./Toast";

type Props = {
  /** The link to copy. Built on the server; the browser never assembles it. */
  url: string;
  /** The wa.me address that opens WhatsApp with the message already written. */
  whatsAppHref: string;
  /** Id of the element that shows the link. A refused copy selects its text so it can be copied by hand. */
  linkElementId: string;
};

// WHY shared (GC-022, GCO-004): the wishlist Share sheet and the exchange invite section offer the
// same two actions with the same wording, so the copy, the toast and the select-on-failure fallback
// live in one place. Renders its buttons as siblings; the parent decides the layout around them.
export function ShareActions({ url, whatsAppHref, linkElementId }: Props) {
  const toast = useToast();

  function selectLink() {
    const node = document.getElementById(linkElementId);
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ message: "Link copied. Paste it anywhere to share." });
    } catch {
      // WHY: a refused copy selects the link, so the person can copy it by hand (owner answer 2026-11-08).
      selectLink();
    }
  }

  return (
    <>
      <Button fullWidth onClick={() => window.open(whatsAppHref, "_blank", "noopener,noreferrer")}>
        Share to WhatsApp
      </Button>
      <Button variant="secondary" fullWidth onClick={copyLink}>
        Copy link
      </Button>
    </>
  );
}
