// Naira amounts (GC-021; plan §5 "price_kobo"). Money is an integer number of kobo, never a float
// (CLAUDE.md "Code rules"). A price is whole naira from ₦1 to ₦1,000,000,000 (owner 2026-11-05),
// so the largest value, 100,000,000,000 kobo, is well inside Number.MAX_SAFE_INTEGER.

export const KOBO_PER_NAIRA = 100;
export const NAIRA_MIN = 1;
export const NAIRA_MAX = 1_000_000_000;

export type NairaParse =
  | { ok: true; kobo: number | null }
  | { ok: false; reason: "not-whole-naira" | "too-large" };

// Reads what someone typed into the ₦ field. Empty means no price. Digits with optional thousands
// commas only: a decimal point, a minus sign or letters are not whole naira. ₦0 is refused too.
export function parseNairaInput(input: string): NairaParse {
  const trimmed = input.trim().replace(/^₦\s*/, "");
  if (trimmed === "") return { ok: true, kobo: null };
  if (!/^[\d,]+$/.test(trimmed)) return { ok: false, reason: "not-whole-naira" };
  const digits = trimmed.replace(/,/g, "").replace(/^0+(?=\d)/, "");
  if (digits === "") return { ok: false, reason: "not-whole-naira" };
  // WHY compare the digit count first: a very long string would lose precision as a Number.
  if (digits.length > String(NAIRA_MAX).length) return { ok: false, reason: "too-large" };
  const naira = Number(digits);
  if (naira > NAIRA_MAX) return { ok: false, reason: "too-large" };
  if (naira < NAIRA_MIN) return { ok: false, reason: "not-whole-naira" };
  return { ok: true, kobo: naira * KOBO_PER_NAIRA };
}

function wholeNaira(kobo: number): number {
  // WHY integer steps, not kobo / 100: the stored value is always a multiple of 100, and this
  // never produces a fraction even if it were not.
  return (kobo - (kobo % KOBO_PER_NAIRA)) / KOBO_PER_NAIRA;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// "₦8,500". Exact amounts only, never rounded or approximate (GC-020).
export function formatNaira(kobo: number): string {
  return `₦${groupThousands(String(wholeNaira(kobo)))}`;
}

// What the ₦ field shows while typing: "300000" becomes "300,000". Anything that is not digits and
// commas is left as typed, so the "whole naira" error can still point at it.
export function groupNairaInput(input: string): string {
  if (!/^[\d,]*$/.test(input)) return input;
  return groupThousands(input.replace(/,/g, ""));
}

// What the field shows when editing a saved price, grouped like the typed value.
export function nairaInputFromKobo(kobo: number | null): string {
  return kobo === null ? "" : groupThousands(String(wholeNaira(kobo)));
}
