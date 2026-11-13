import { describe, expect, it } from "vitest";
import { digitsOnly } from "../../components/ui/otp-digits.ts";
import { classifyAuthError } from "../../lib/auth/auth-errors.ts";
import { DISPLAY_NAME_MAX, normaliseDisplayName } from "../../lib/auth/display-name.ts";
import { isPlausibleEmail, normaliseEmail } from "../../lib/auth/email.ts";
import { DEFAULT_NEXT_PATH, safeNextOrUndefined, sanitizeNext } from "../../lib/auth/next-path.ts";
import {
  cooldownRemainingMs,
  destinationAfterVerify,
  formatCountdown,
  parseVerifyJson,
  parseVerifyState,
  RESEND_COOLDOWN_MS,
} from "../../lib/auth/verify-state.ts";
import { formatLongDate } from "../../lib/dates/format-long-date.ts";

describe("sanitizeNext (AC: next is sanitised)", () => {
  it("keeps a plain same-site path, with query and hash", () => {
    expect(sanitizeNext("/exchanges/abc?item=1#top")).toBe("/exchanges/abc?item=1#top");
    expect(sanitizeNext("/home")).toBe("/home");
  });
  it("falls back to Home for nothing, non-strings and empty text", () => {
    expect(sanitizeNext(undefined)).toBe(DEFAULT_NEXT_PATH);
    expect(sanitizeNext(null)).toBe(DEFAULT_NEXT_PATH);
    expect(sanitizeNext(["/home"])).toBe(DEFAULT_NEXT_PATH);
    expect(sanitizeNext("")).toBe(DEFAULT_NEXT_PATH);
  });
  it.each([
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "http://evil.com/x",
    "javascript:alert(1)",
    "evil.com",
    "home",
    "/%2F%2Fevil.com",
    "/%5Cevil.com",
    "/%252F%252Fevil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/%09/evil.com",
    "/%0d%0a/evil.com",
    "/a\u0000b",
    "/%E0%A4%A",
  ])("rejects %j", (bad) => {
    expect(sanitizeNext(bad)).toBe(DEFAULT_NEXT_PATH);
  });
  it("safeNextOrUndefined gives nothing for junk, so no ?next= is carried", () => {
    expect(safeNextOrUndefined("/exchanges/1")).toBe("/exchanges/1");
    expect(safeNextOrUndefined("//evil.com")).toBeUndefined();
    expect(safeNextOrUndefined(undefined)).toBeUndefined();
    expect(safeNextOrUndefined(["/home"])).toBeUndefined();
  });
  it("rejects very long input", () => {
    expect(sanitizeNext(`/${"a".repeat(600)}`)).toBe(DEFAULT_NEXT_PATH);
  });
});

describe("verify state (GC-003)", () => {
  const now = 1_800_000_000_000;
  const good = { v: 1, email: "ada@example.com", flow: "signup", firstName: "Ada", next: "/i/abc", sentAt: now - 5000 };

  it("accepts exactly the shape we write", () => {
    expect(parseVerifyState(good, now)).toEqual(good);
    expect(parseVerifyState({ v: 1, email: "ada@example.com", flow: "login", sentAt: now }, now)).toEqual({
      v: 1,
      email: "ada@example.com",
      flow: "login",
      sentAt: now,
    });
  });
  it("rejects wrong versions, shapes and values", () => {
    expect(parseVerifyState(null, now)).toBeNull();
    expect(parseVerifyState([], now)).toBeNull();
    expect(parseVerifyState({ ...good, v: 2 }, now)).toBeNull();
    expect(parseVerifyState({ ...good, email: "not-an-email" }, now)).toBeNull();
    expect(parseVerifyState({ ...good, email: "ADA@example.com" }, now)).toBeNull();
    expect(parseVerifyState({ ...good, flow: "other" }, now)).toBeNull();
    expect(parseVerifyState({ ...good, firstName: "" }, now)).toBeNull();
    expect(parseVerifyState({ ...good, firstName: "a".repeat(51) }, now)).toBeNull();
    expect(parseVerifyState({ ...good, firstName: 5 }, now)).toBeNull();
    expect(parseVerifyState({ ...good, sentAt: "now" }, now)).toBeNull();
    expect(parseVerifyState({ ...good, sentAt: Number.NaN }, now)).toBeNull();
  });
  it("rejects an unsafe next path rather than repairing it", () => {
    expect(parseVerifyState({ ...good, next: "//evil.com" }, now)).toBeNull();
    expect(parseVerifyState({ ...good, next: "https://evil.com" }, now)).toBeNull();
  });
  it("expires after 30 minutes and refuses a time in the future", () => {
    expect(parseVerifyState({ ...good, sentAt: now - 31 * 60_000 }, now)).toBeNull();
    expect(parseVerifyState({ ...good, sentAt: now - 29 * 60_000 }, now)).not.toBeNull();
    expect(parseVerifyState({ ...good, sentAt: now + 10 * 60_000 }, now)).toBeNull();
  });
  it("reads JSON text and survives garbage", () => {
    expect(parseVerifyJson(JSON.stringify(good), now)).toEqual(good);
    expect(parseVerifyJson("{not json", now)).toBeNull();
    expect(parseVerifyJson("", now)).toBeNull();
    expect(parseVerifyJson(undefined, now)).toBeNull();
  });
});

describe("resend cooldown", () => {
  it("lasts 60 seconds from the send", () => {
    expect(RESEND_COOLDOWN_MS).toBe(60_000);
    expect(cooldownRemainingMs(1000, 1000)).toBe(60_000);
    expect(cooldownRemainingMs(1000, 31_000)).toBe(30_000);
    expect(cooldownRemainingMs(1000, 61_000)).toBe(0);
    expect(cooldownRemainingMs(1000, 999_999)).toBe(0);
  });
  it("shows m:ss, starting at 0:59 as the design does", () => {
    expect(formatCountdown(60_000)).toBe("0:59");
    expect(formatCountdown(59_000)).toBe("0:59");
    expect(formatCountdown(58_100)).toBe("0:59");
    expect(formatCountdown(42_000)).toBe("0:42");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
  });
});

describe("destinationAfterVerify", () => {
  it("sends a new account to Profile setup, keeping a deep link for after it", () => {
    expect(destinationAfterVerify({ flow: "signup" })).toBe("/welcome");
    expect(destinationAfterVerify({ flow: "signup", next: "/i/abc" })).toBe("/welcome?next=%2Fi%2Fabc");
  });
  it("sends a returning person to their page, or Home", () => {
    expect(destinationAfterVerify({ flow: "login" })).toBe("/home");
    expect(destinationAfterVerify({ flow: "login", next: "/exchanges/1" })).toBe("/exchanges/1");
  });
  // An abandoned sign-up that logs in is sent to Profile setup by the server (profiles.onboarded_at,
  // lib/auth/session.ts), not here; the signed-in e2e "R1-1" test covers it with a real account.
});

describe("classifyAuthError", () => {
  it("maps Supabase errors to the states the screens show", () => {
    expect(classifyAuthError({ name: "AuthRetryableFetchError", status: 0 })).toBe("network");
    expect(classifyAuthError({ status: 0 })).toBe("network");
    expect(classifyAuthError({ status: 422, code: "otp_disabled", message: "Signups not allowed for otp" })).toBe(
      "no-account",
    );
    expect(classifyAuthError({ message: "Signups not allowed for otp" })).toBe("no-account");
    expect(classifyAuthError({ status: 429, code: "over_email_send_rate_limit" })).toBe("rate-limited");
    expect(classifyAuthError({ status: 429 })).toBe("rate-limited");
    expect(classifyAuthError({ status: 403, code: "otp_expired", message: "Token has expired or is invalid" })).toBe(
      "wrong-code",
    );
    expect(classifyAuthError({ status: 500, code: "unexpected_failure" })).toBe("unknown");
    expect(classifyAuthError({})).toBe("unknown");
  });
});

describe("normaliseDisplayName (GC-005)", () => {
  it("trims and collapses spaces", () => {
    expect(normaliseDisplayName("  Ada   Okafor ")).toBe("Ada Okafor");
    expect(normaliseDisplayName("   ")).toBe("");
  });
  it("truncates to 50 code points", () => {
    expect(Array.from(normaliseDisplayName("a".repeat(80))).length).toBe(DISPLAY_NAME_MAX);
  });
  it("counts an emoji as one and never splits one", () => {
    const smile = "\u{1F600}";
    expect(Array.from(normaliseDisplayName(smile.repeat(80))).length).toBe(DISPLAY_NAME_MAX);
    // A family emoji is 7 code points joined; a 46-letter prefix leaves room for 4, so it is dropped whole.
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}";
    expect(normaliseDisplayName("a".repeat(46) + family)).toBe("a".repeat(46));
    // An accented letter written as e plus a combining mark stays together.
    const accented = normaliseDisplayName("é".repeat(60));
    expect(accented.startsWith("é")).toBe(true);
    expect(Array.from(accented).length).toBeLessThanOrEqual(DISPLAY_NAME_MAX);
  });
  it("does not leave a trailing space after truncating", () => {
    expect(normaliseDisplayName(`${"a".repeat(49)} b`)).toBe("a".repeat(49));
  });
});

describe("email checks", () => {
  it("normalises case and spaces", () => {
    expect(normaliseEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
  it("accepts plausible addresses and rejects incomplete ones", () => {
    expect(isPlausibleEmail("ada@example.com")).toBe(true);
    expect(isPlausibleEmail("a.b+c@sub.example.co")).toBe(true);
    expect(isPlausibleEmail("amaka.obi@gmail")).toBe(false);
    expect(isPlausibleEmail("amaka.obi@")).toBe(false);
    expect(isPlausibleEmail("")).toBe(false);
    expect(isPlausibleEmail("a b@example.com")).toBe(false);
    expect(isPlausibleEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("digitsOnly (OtpInput)", () => {
  it("strips non-digits and caps at six", () => {
    expect(digitsOnly("482915")).toBe("482915");
    expect(digitsOnly("482 915")).toBe("482915");
    expect(digitsOnly("48-29-15")).toBe("482915");
    expect(digitsOnly("abc")).toBe("");
    expect(digitsOnly("12345678")).toBe("123456");
  });
});

describe("formatLongDate", () => {
  it("shows weekday, day and month in the given zone, with no comma", () => {
    const d = new Date("2026-10-31T23:30:00Z");
    expect(formatLongDate(d, "Africa/Lagos")).toBe("Sunday 1 November");
    expect(formatLongDate(d, "UTC")).toBe("Saturday 31 October");
  });
});
