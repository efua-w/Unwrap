import { normaliseSingleLine } from "../validation/text";

export const DISPLAY_NAME_MAX = 50;

// WHY (GC-005): "very long or emoji-only names truncate safely". The limit is 50 code points, the
// same unit the database check counts (char_length). Whole graphemes are kept together, so an
// emoji with modifiers or an accented letter is never cut in half. Returns "" for a blank name,
// which the caller reports as "name missing".
export function normaliseDisplayName(input: string): string {
  return normaliseSingleLine(input, DISPLAY_NAME_MAX);
}
