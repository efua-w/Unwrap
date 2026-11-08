import { describe, expect, it } from "vitest";
import { accountStatusFrom } from "../../lib/auth/account-status.ts";
import { findLeaks } from "../../scripts/check-client-secrets.ts";

const EMAIL = "amaka.obi@example.com";
const confirmed = { email: EMAIL, emailConfirmedAt: "2026-11-04T10:00:00Z" };
const unconfirmed = { email: EMAIL, emailConfirmedAt: null };
const longer = { email: `x${EMAIL}`, emailConfirmedAt: "2026-11-04T10:00:00Z" };

describe("accountStatusFrom (open item 36)", () => {
  it("a confirmed exact match is confirmed", () => {
    expect(accountStatusFrom(EMAIL, [longer, confirmed], 2)).toBe("confirmed");
  });

  it("an unconfirmed exact match continues as a sign-up", () => {
    expect(accountStatusFrom(EMAIL, [unconfirmed], 1)).toBe("not-confirmed");
  });

  it("compares the stored email case-insensitively", () => {
    expect(accountStatusFrom(EMAIL, [{ ...confirmed, email: "Amaka.Obi@Example.com" }], 1)).toBe("confirmed");
  });

  it("no exact match among the whole substring match is a new address", () => {
    expect(accountStatusFrom(EMAIL, [], 0)).toBe("not-confirmed");
    expect(accountStatusFrom(EMAIL, [longer], 1)).toBe("not-confirmed");
  });

  it("a partial page, or an unknown total, without the exact address cannot decide", () => {
    expect(accountStatusFrom(EMAIL, [longer], 51)).toBe("unknown");
    expect(accountStatusFrom(EMAIL, [longer], null)).toBe("unknown");
  });

  it("a user without an email never matches", () => {
    expect(accountStatusFrom(EMAIL, [{ email: null, emailConfirmedAt: "2026-11-04T10:00:00Z" }], 1)).toBe("not-confirmed");
  });
});

describe("secrets:check findLeaks", () => {
  const value = "sb_secret_0123456789abcdef";
  it("finds the name and the value, and reports only the file", () => {
    const leaks = findLeaks(
      [
        { file: "a.js", content: "process.env.SUPABASE_SECRET_KEY" },
        { file: "b.js", content: `const k="${value}"` },
        { file: "c.js", content: "nothing here" },
      ],
      ["SUPABASE_SECRET_KEY"],
      [value],
    );
    expect(leaks).toEqual([
      { file: "a.js", found: "name" },
      { file: "b.js", found: "value" },
    ]);
    expect(JSON.stringify(leaks)).not.toContain(value);
  });

  it("ignores an empty or very short value", () => {
    expect(findLeaks([{ file: "a.js", content: "abc" }], [], ["", "abc"])).toEqual([]);
  });
});
