// 12-hour clock helpers for the Draw time field (GCO-002). The form state and server stay 24-hour
// "HH:MM"; only the field shows h:mm with AM/PM. Pure, so they are unit-tested.

export type Period = "AM" | "PM";
export type Time12 = { hour: number; minute: number; period: Period };

// The normalised text shown after blur: "6:05".
export function formatTime12Text(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

// 12-hour parts to "HH:MM". 12 AM is 00:00 and 12 PM is 12:00.
export function to24Hm({ hour, minute, period }: Time12): string {
  const h = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// "HH:MM" to 12-hour parts. Null for anything that is not a real time.
export function from24Hm(hm: string): Time12 | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!match) return null;
  const h = Number(match[1]);
  const minute = Number(match[2]);
  if (h > 23 || minute > 59) return null;
  return { hour: h % 12 === 0 ? 12 : h % 12, minute, period: h >= 12 ? "PM" : "AM" };
}

export type TimeOption = { hour: number; minute: number; label: string };

// The picker list (GCO-002 Draw time, owner decision 2026-11-11): every 30 minutes, 12:00 first then
// 12:30, 1:00 ... 11:30. The AM/PM switch decides which half of the day they mean.
export const TIME_OPTIONS: readonly TimeOption[] = Array.from({ length: 24 }, (_, i) => {
  const hour = i < 2 ? 12 : Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return { hour, minute, label: formatTime12Text(hour, minute) };
});
