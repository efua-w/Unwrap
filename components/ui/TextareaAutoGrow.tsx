"use client";

import { useEffect } from "react";
import { fitTextareaHeight } from "./textarea-fit";

function fit(el: HTMLTextAreaElement) {
  const style = getComputedStyle(el);
  const max = Number.parseFloat(style.maxHeight);
  el.style.height = "auto";
  el.style.height = `${fitTextareaHeight(
    el.scrollHeight,
    Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth),
    Number.parseFloat(style.minHeight) || 0,
    Number.isFinite(max) ? max : Number.POSITIVE_INFINITY,
  )}px`;
}

// Growth fallback for a Field textarea. Reads the field by id so Field itself stays a Server
// Component. WHY: Firefox has no `field-sizing: content`, so without this the textarea scrolls
// instead of growing (open item 11). Does nothing where the CSS property is supported.
export function TextareaAutoGrow({ targetId, value }: { targetId: string; value?: string }) {
  useEffect(() => {
    if (CSS.supports("field-sizing", "content")) return;
    const el = document.getElementById(targetId);
    if (!(el instanceof HTMLTextAreaElement)) return;
    const onInput = () => fit(el);
    fit(el);
    // WHY: a form reset restores the default text without an input event (same as CharacterCount, R1-16).
    const form = el.form;
    const onReset = () => setTimeout(onInput, 0);
    // WHY: narrower text wraps onto more lines, so a width change needs a new height. Height changes
    // (made by fit itself) are ignored to avoid a loop.
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit(el);
    });
    observer.observe(el);
    el.addEventListener("input", onInput);
    form?.addEventListener("reset", onReset);
    return () => {
      observer.disconnect();
      el.removeEventListener("input", onInput);
      form?.removeEventListener("reset", onReset);
      el.style.height = "";
    };
  }, [targetId]);

  // WHY: a controlled field changes its text from code, which fires no input event.
  useEffect(() => {
    if (CSS.supports("field-sizing", "content")) return;
    const el = document.getElementById(targetId);
    if (el instanceof HTMLTextAreaElement) fit(el);
  }, [targetId, value]);

  return null;
}
