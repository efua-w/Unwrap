export const DISPLAY_NAME_MAX = 50;

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

// WHY (GC-005): "very long or emoji-only names truncate safely". The limit is 50 code points, the
// same unit the database check counts (char_length). Whole graphemes are kept together, so an
// emoji with modifiers or an accented letter is never cut in half. Returns "" for a blank name,
// which the caller reports as "name missing".
export function normaliseDisplayName(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  let out = "";
  let count = 0;
  for (const { segment } of segmenter.segment(trimmed)) {
    const size = Array.from(segment).length;
    if (count + size > DISPLAY_NAME_MAX) break;
    out += segment;
    count += size;
  }
  return out.trim();
}
