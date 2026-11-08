const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

// Keeps at most `max` code points (the unit Postgres char_length counts) without splitting a
// grapheme, so an emoji with modifiers or an accented letter is never cut in half.
export function clampCodePoints(text: string, max: number): string {
  let out = "";
  let count = 0;
  for (const { segment } of segmenter.segment(text)) {
    const size = Array.from(segment).length;
    if (count + size > max) break;
    out += segment;
    count += size;
  }
  return out;
}

// A one-line value (names): trimmed, inner runs of whitespace collapsed, then clamped. Returns ""
// for a blank value, which callers report as missing.
export function normaliseSingleLine(input: string, max: number): string {
  return clampCodePoints(input.trim().replace(/\s+/g, " "), max).trim();
}
