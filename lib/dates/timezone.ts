export const DEFAULT_TIME_ZONE = "Africa/Lagos";
export const TIME_ZONE_COOKIE = "tz";

// WHY: the `tz` cookie is client-supplied and untrusted. Only a name `Intl` accepts is used;
// anything else falls back to Lagos. Dates show in the viewer's own zone (product rules).
export function isValidTimeZone(value: string): boolean {
  if (value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function getViewerTimeZone(cookieValue: string | undefined | null): string {
  if (!cookieValue) return DEFAULT_TIME_ZONE;
  return isValidTimeZone(cookieValue) ? cookieValue : DEFAULT_TIME_ZONE;
}
