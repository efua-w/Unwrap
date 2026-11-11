import { useEffect, useRef, useState } from "react";

// WHY a min-width query on open, not a CSS-only swap: the dropdown and the sheet are different
// elements, and only one may be in the DOM (one popup, one set of ids).
const DESKTOP = "(min-width: 48rem)"; // the md breakpoint

export type PickerMode = "closed" | "dropdown" | "sheet";

// Open/close state shared by the picker fields (TimeField12, DateField): a dropdown from 768, the
// Sheet below it, a click outside closes the dropdown, and closing returns focus to the trigger.
export function usePicker() {
  const [mode, setMode] = useState<PickerMode>("closed");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "dropdown") return;
    // Esc is handled on the field; this is the click outside.
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMode("closed");
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mode]);

  function openPicker() {
    setMode(window.matchMedia(DESKTOP).matches ? "dropdown" : "sheet");
  }

  // Closes without moving focus (Tab out of the dropdown).
  function dismiss() {
    setMode("closed");
  }

  function close() {
    setMode("closed");
    // The sheet returns focus itself; the dropdown may have moved it, so put it back.
    if (mode === "dropdown") triggerRef.current?.focus();
  }

  return { mode, triggerRef, wrapRef, openPicker, dismiss, close };
}
