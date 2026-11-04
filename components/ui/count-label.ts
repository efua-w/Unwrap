export const COUNT_CAP = 9;

// Unread and similar counts: hidden at 0, "9+" above nine (board 12).
export function countLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const whole = Math.floor(count);
  return whole > COUNT_CAP ? `${COUNT_CAP}+` : String(whole);
}
