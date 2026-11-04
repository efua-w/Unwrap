"use client";

import { useEffect, useState } from "react";

// Live "n/max" counter for a Field. Reads the field by id so Field itself stays a Server Component.
export function CharacterCount({ targetId, max, initial }: { targetId: string; max: number; initial: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    const update = () => setCount(el.value.length);
    update();
    // WHY: a form reset restores the default value without an input event, so the count would
    // go stale (R1-16). The reset event fires before the values change, hence the timeout.
    const form = el.form;
    const onReset = () => setTimeout(update, 0);
    el.addEventListener("input", update);
    form?.addEventListener("reset", onReset);
    return () => {
      el.removeEventListener("input", update);
      form?.removeEventListener("reset", onReset);
    };
  }, [targetId]);

  return (
    <span className="ml-auto shrink-0 text-body-sm-regular text-text-muted">
      {count}/{max}
    </span>
  );
}
