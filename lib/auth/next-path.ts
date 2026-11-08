export const DEFAULT_NEXT_PATH = "/home";

const MAX_LENGTH = 512;
// WHY: control characters (tab, CR, LF) are how a browser is tricked into reading "/<tab>/evil" as "//evil".
const CONTROL = /[\u0000-\u001f\u007f]/;

function isUnsafe(path: string): boolean {
  return !path.startsWith("/") || path.startsWith("//") || path.includes("\\") || CONTROL.test(path);
}

// WHY (GC-003, GC-004): `next` comes from the URL, so it is untrusted input. It may only ever be a
// same-site path. Anything else (another site, "//host", "/host", a scheme, control characters,
// or any of those hidden behind percent-encoding) is refused, so a log-in link cannot be turned
// into an open redirect. Returns the path unchanged when it is safe, otherwise null.
function checkNext(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return null;
  // Check the raw text and every decoded form (twice-encoded input is still caught).
  let current = raw;
  for (let i = 0; i < 4; i += 1) {
    if (isUnsafe(current)) return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (decoded === current) break;
    current = decoded;
  }
  // Final proof: resolving it against a throwaway origin must stay on that origin.
  try {
    const base = "http://next.invalid";
    if (new URL(raw, base).origin !== base) return null;
  } catch {
    return null;
  }
  return raw;
}

// For where to go after a step: a safe path, or Home.
export function sanitizeNext(raw: unknown): string {
  return checkNext(raw) ?? DEFAULT_NEXT_PATH;
}

// For carrying `next` along a link: a safe path, or nothing (so no `?next=` is added for junk).
export function safeNextOrUndefined(raw: unknown): string | undefined {
  return checkNext(raw) ?? undefined;
}
