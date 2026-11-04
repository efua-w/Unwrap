// Height for a textarea that grows with its text, for browsers without `field-sizing: content`.
// `scrollHeight` excludes the border, and the textarea is border-box, so the border is added back.
// Never below `min`; never above `max` (pass Infinity when the design sets none).
export function fitTextareaHeight(scrollHeight: number, borderY: number, min: number, max: number): number {
  return Math.min(Math.max(scrollHeight + borderY, min), max);
}
