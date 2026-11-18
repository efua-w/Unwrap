import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { budgetLabel, BUDGET_PRESETS } from "../../lib/money/budget.ts";
import { formatDayTime, zoneShortName, formatDay } from "../../lib/dates/format.ts";
import { budgetText, formatGiftDay, formatMoment } from "../../supabase/functions/_shared/emails/dates.ts";
import { escapeHtml, firstName, oneLine } from "../../supabase/functions/_shared/emails/escape.ts";
import { cleanBaseUrl, exchangeLink, inviteLink, notificationsLink, participantsLink } from "../../supabase/functions/_shared/emails/links.ts";
import { renderEmail } from "../../supabase/functions/_shared/emails/render.ts";
import { EMAIL_TEMPLATES, type EmailTemplate, type RenderInput } from "../../supabase/functions/_shared/emails/types.ts";
import { bearerToken, secretsMatch } from "../../supabase/functions/send-emails/auth.ts";
import { parseDueRow, runSender, type Ports } from "../../supabase/functions/send-emails/process.ts";

const BASE = "https://unwrap.ink";
const EX = "0b9d6e0e-6b4b-4a3c-9d57-1d3f6a1d2c11";
const JOIN_BY = "2026-11-27T17:00:00Z";
const TOKEN = "0123456789abcdef0123456789abcdef";

const noOther = (t: EmailTemplate) => t === "E09" || t === "E12";

function input(template: EmailTemplate, over: Partial<RenderInput> = {}): RenderInput {
  return {
    template,
    toName: "Tolu Adeyemi",
    toEmail: "tolu@example.com",
    exchangeId: EX,
    exchangeName: "Family Christmas 2026",
    otherName: noOther(template) ? null : "Chidi Okeke",
    inviteToken: template === "E06" ? TOKEN : null,
    toTimezone: "Africa/Lagos",
    budgetPreset: template === "E06" ? "10k_20k" : null,
    joinByAt: template === "E06" ? JOIN_BY : null,
    giftDay: template === "E06" ? "2026-12-24" : null,
    note: template === "E06" ? "Let's keep it fun this year." : null,
    ...over,
  };
}

describe("escaping (AC-14)", () => {
  it("escapes the five HTML characters", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jo'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jo&#39;&lt;/a&gt;");
  });

  it.each(EMAIL_TEMPLATES)("%s never lets a typed name become markup", (template) => {
    const hostile = `<script>alert(1)</script>"><img src=x>`;
    const { html } = renderEmail(
      input(template, { toName: hostile, exchangeName: hostile, otherName: noOther(template) ? null : hostile }),
      BASE,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps a subject on one line", () => {
    const { subject } = renderEmail(input("E12", { exchangeName: "Line one\r\nBcc: x@example.com" }), BASE);
    expect(subject).not.toMatch(/[\r\n]/);
    expect(oneLine("  a \n b ")).toBe("a b");
  });

  it("greets by first name", () => {
    expect(firstName("  Tolu   Adeyemi ")).toBe("Tolu");
    expect(renderEmail(input("E12"), BASE).html).toContain("Hi Tolu,");
    expect(renderEmail(input("E12", { toName: null }), BASE).html).toContain("Hi there,");
    expect(renderEmail(input("E06", { toName: "Ignored" }), BASE).html).toContain("Hi there,");
  });
});

describe("E06 details (round 3, owner 2026-11-17)", () => {
  it.each([
    ["Africa/Lagos", "Fri 27 Nov, 6:00 pm WAT"],
    ["Europe/London", "Fri 27 Nov, 5:00 pm GMT"],
    ["America/New_York", "Fri 27 Nov, 12:00 pm GMT-5"],
  ])("shows join-by in %s with its zone label", (zone, expected) => {
    expect(formatMoment(JOIN_BY, zone)).toBe(expected);
    const { html, text } = renderEmail(input("E06", { toTimezone: zone }), BASE);
    expect(html).toContain(expected);
    expect(text).toContain(`Join by: ${expected}`);
  });

  it("moves to the next day for a zone ahead of UTC, and matches the app's own formatter", () => {
    expect(formatMoment(JOIN_BY, "Pacific/Auckland")).toMatch(/^Sat 28 Nov, 6:00 am /);
    for (const zone of ["Africa/Lagos", "Europe/London", "America/New_York", "Asia/Kolkata", "Pacific/Auckland"]) {
      const date = new Date(JOIN_BY);
      expect(formatMoment(JOIN_BY, zone)).toBe(`${formatDayTime(date, zone)} ${zoneShortName(date, zone)}`);
    }
  });

  it("an unknown zone name falls back to UTC instead of failing", () => {
    expect(formatMoment(JOIN_BY, "Not/AZone")).toBe("Fri 27 Nov, 5:00 pm UTC");
  });

  it("shows the gift day as the stored date, whatever the zone", () => {
    expect(formatGiftDay("2026-12-24")).toBe("Thu 24 Dec");
    expect(formatGiftDay("2026-12-24")).toBe(formatDay(new Date(Date.UTC(2026, 11, 24, 12)), "UTC"));
    for (const zone of ["Pacific/Auckland", "America/Los_Angeles"]) {
      expect(renderEmail(input("E06", { toTimezone: zone }), BASE).html).toContain("Thu 24 Dec");
    }
    expect(formatGiftDay("not a date")).toBeNull();
  });

  it("budget labels match the app's", () => {
    for (const preset of BUDGET_PRESETS) expect(budgetText(preset)).toBe(budgetLabel(preset));
    expect(budgetText("nope")).toBeNull();
  });

  it("shows budget, join-by, gift day and the organiser's note, in the board's order", () => {
    const { html } = renderEmail(input("E06"), BASE);
    const at = ["Budget per gift", "₦10,000 to ₦20,000", "Join by", "Fri 27 Nov, 6:00 pm WAT", "Gift day", "Thu 24 Dec", "A note from Chidi", "Let&#39;s keep it fun this year."].map((t) => html.indexOf(t));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("leaves out a row whose value is missing, and a blank note", () => {
    const { html } = renderEmail(input("E06", { budgetPreset: null, joinByAt: "garbage", giftDay: null, note: "   " }), BASE);
    for (const label of ["Budget per gift", "Join by", "Gift day", "A note from"]) expect(html).not.toContain(label);
  });

  it("escapes the note and keeps its line breaks", () => {
    const { html } = renderEmail(input("E06", { note: "<b>Hi</b>\nBring snacks" }), BASE);
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt;<br>Bring snacks");
    expect(html).not.toContain("<b>Hi");
  });

  it("only E06 carries the details, and nothing promises the draw or a reminder", () => {
    for (const template of ["E07", "E08", "E09", "E12"] as const) {
      const { html } = renderEmail(input(template, { budgetPreset: "10k_20k", joinByAt: JOIN_BY, giftDay: "2026-12-24", note: "A note" }), BASE);
      expect(html).not.toMatch(/Budget per gift|Join by|Gift day|A note from/);
    }
    for (const out of Object.values(renderEmail(input("E06"), BASE))) {
      expect(out).not.toMatch(/Names drawn|we draw names|remind|draw date|automatically/i);
    }
  });
});

describe("links (Q5)", () => {
  it("builds each link on the base URL from an existing route", () => {
    expect(inviteLink(BASE, TOKEN)).toBe(`${BASE}/i/${TOKEN}`);
    expect(exchangeLink(BASE, EX)).toBe(`${BASE}/exchanges/${EX}`);
    expect(participantsLink(BASE, EX)).toBe(`${BASE}/exchanges/${EX}/participants`);
    expect(notificationsLink(BASE)).toBe(`${BASE}/profile/notifications`);
  });

  it("drops any path on the base and refuses other schemes", () => {
    expect(cleanBaseUrl("https://unwrap.ink/some/path/")).toBe("https://unwrap.ink");
    expect(() => cleanBaseUrl("javascript:alert(1)")).toThrow();
  });

  it("refuses a malformed id or token", () => {
    expect(() => exchangeLink(BASE, "../../x")).toThrow();
    expect(() => inviteLink(BASE, "abc")).toThrow();
  });

  it("uses the right link in each email", () => {
    expect(renderEmail(input("E06"), BASE).html).toContain(`href="${BASE}/i/${TOKEN}"`);
    expect(renderEmail(input("E07"), BASE).html).toContain(`href="${BASE}/exchanges/${EX}"`);
    expect(renderEmail(input("E08"), BASE).html).toContain(`href="${BASE}/exchanges/${EX}/participants"`);
    expect(renderEmail(input("E09"), BASE).html).toContain(`href="${BASE}/exchanges/${EX}"`);
    expect(renderEmail(input("E12"), BASE).html).not.toContain(`${BASE}/exchanges`);
  });

  it("fails a render with a missing token instead of sending a broken link", () => {
    expect(() => renderEmail(input("E06", { inviteToken: null }), BASE)).toThrow();
  });
});

describe("content (AC-2, AC-3, AC-15)", () => {
  it("has no stop-invites or unsubscribe link (Q6) and no promise of a later slice (Q9)", () => {
    for (const template of EMAIL_TEMPLATES) {
      const { html, text } = renderEmail(input(template), BASE);
      for (const out of [html, text]) {
        expect(out).not.toMatch(/stop invite emails|unsubscribe|reminder|auto-?close|Wishlists in/i);
      }
    }
  });

  it("E07 and E08 carry the settings link, and E06, E09 and E12 do not", () => {
    const settings = `${BASE}/profile/notifications`;
    expect(renderEmail(input("E07"), BASE).html).toContain(settings);
    expect(renderEmail(input("E08"), BASE).html).toContain(settings);
    for (const template of ["E06", "E09", "E12"] as const) {
      expect(renderEmail(input(template), BASE).html).not.toContain(settings);
    }
  });

  it("E09 and E12 name no organiser, reason or other person", () => {
    for (const template of ["E09", "E12"] as const) {
      const { html, subject } = renderEmail(input(template, { otherName: "Amaka Obi" }), BASE);
      expect(html + subject).not.toContain("Amaka");
    }
    expect(renderEmail(input("E12"), BASE).html).not.toMatch(/organi[sz]er|removed by/i);
  });

  it("only E06 prints an address, and only the recipient's own", () => {
    for (const template of EMAIL_TEMPLATES) {
      const { html, text } = renderEmail(input(template), BASE);
      const found = [...(html + text).matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map((m) => m[0]);
      if (template === "E06") expect(new Set(found)).toEqual(new Set(["tolu@example.com"]));
      else expect(found).toEqual([]);
    }
  });

  it("uses the board subjects", () => {
    expect(renderEmail(input("E06"), BASE).subject).toBe("Chidi invited you to Family Christmas 2026");
    expect(renderEmail(input("E07"), BASE).subject).toBe("Chidi joined Family Christmas 2026");
    expect(renderEmail(input("E08"), BASE).subject).toBe("Chidi wants to join Family Christmas 2026");
    expect(renderEmail(input("E09"), BASE).subject).toBe("You're in Family Christmas 2026");
    expect(renderEmail(input("E12"), BASE).subject).toBe("You're no longer in Family Christmas 2026");
  });
});

describe("the input type has no field for hidden data (AC-2)", () => {
  const source = readFileSync("supabase/functions/_shared/emails/types.ts", "utf8");
  const typeBody = source.slice(source.indexOf("export type RenderInput"), source.indexOf("export type RenderedEmail"));
  // WHY only the field lines: the type's comments explain what is absent, so they name those words.
  const fields = [...typeBody.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1] ?? "");

  it("names no pair, giver, receiver, reservation, assignment, draw or wishlist field", () => {
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) expect(field).not.toMatch(/giver|receiver|recipient|assign|reserv|pair|draw|item|wishlist/i);
  });

  it("has exactly one address field, the recipient's", () => {
    expect(fields.filter((f) => /email|address/i.test(f))).toEqual(["toEmail"]);
  });
});

describe("sender auth", () => {
  it("accepts only the exact shared secret", () => {
    expect(bearerToken("Bearer abc")).toBe("abc");
    expect(bearerToken("abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(secretsMatch("long-secret", "long-secret")).toBe(true);
    expect(secretsMatch("long-secreT", "long-secret")).toBe(false);
    expect(secretsMatch("long", "long-secret")).toBe(false);
    expect(secretsMatch(null, "long-secret")).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
  });
});

describe("a sender run (AC-13)", () => {
  const dbRow = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    template: "E07",
    to_email: "tolu@example.com",
    to_name: "Tolu Adeyemi",
    to_timezone: "Africa/Lagos",
    exchange_id: EX,
    exchange_name: "Family Christmas 2026",
    other_name: "Chidi Okeke",
    invite_token: null,
    attempts: 0,
    ...over,
  });

  function ports(rows: unknown[], send: Ports["send"]) {
    const marks: Array<[string, string | null]> = [];
    const p: Ports = {
      appBaseUrl: BASE,
      claim: async () => rows,
      mark: async (id, code) => {
        marks.push([id, code]);
      },
      send,
    };
    return { p, marks };
  }

  it("sends each claimed row once with its id and marks it sent", async () => {
    const calls: Array<{ id: string; to: string }> = [];
    const { p, marks } = ports([dbRow("r1"), dbRow("r2", { template: "E12", other_name: null })], async (id, to) => {
      calls.push({ id, to });
      return { ok: true };
    });
    const summary = await runSender(p);
    expect(summary).toEqual({ claimed: 2, sent: 2, failed: 0 });
    expect(calls).toEqual([
      { id: "r1", to: "tolu@example.com" },
      { id: "r2", to: "tolu@example.com" },
    ]);
    expect(marks).toEqual([
      ["r1", null],
      ["r2", null],
    ]);
  });

  it("writes a failure back as a short code only, and carries on", async () => {
    const { p, marks } = ports([dbRow("r1"), dbRow("r2")], async (id) => (id === "r1" ? { ok: false, code: "resend_429" } : { ok: true }));
    const summary = await runSender(p);
    expect(summary).toEqual({ claimed: 2, sent: 1, failed: 1 });
    expect(marks).toEqual([
      ["r1", "resend_429"],
      ["r2", null],
    ]);
    expect(JSON.stringify(summary)).not.toContain("@");
  });

  it("fails an unknown template or a bad row without sending", async () => {
    let sends = 0;
    const { p, marks } = ports(
      [dbRow("r1", { template: "E99" }), dbRow("r2", { exchange_name: null }), dbRow("r3", { template: "E06", invite_token: null })],
      async () => {
        sends += 1;
        return { ok: true };
      },
    );
    await runSender(p);
    expect(sends).toBe(0);
    expect(marks).toEqual([
      ["r1", "unknown_template"],
      ["r2", "bad_row"],
      ["r3", "render_failed"],
    ]);
  });

  it("does not stop the batch when writing a result back fails", async () => {
    const sent: string[] = [];
    const p: Ports = {
      appBaseUrl: BASE,
      claim: async () => [dbRow("r1"), dbRow("r2")],
      mark: async (id) => {
        if (id === "r1") throw new Error("rpc_500");
      },
      send: async (id) => {
        sent.push(id);
        return { ok: true };
      },
    };
    expect(await runSender(p)).toEqual({ claimed: 2, sent: 1, failed: 1 });
    expect(sent).toEqual(["r1", "r2"]);
  });

  it("parses the claim columns", () => {
    expect(parseDueRow(dbRow("r1")).row).toMatchObject({ id: "r1", template: "E07", toName: "Tolu Adeyemi", otherName: "Chidi Okeke", toTimezone: "Africa/Lagos", budgetPreset: null });
    expect(
      parseDueRow(dbRow("r2", { template: "E06", invite_token: TOKEN, budget_preset: "5k_10k", join_by_at: JOIN_BY, gift_day: "2026-12-24", note: "Hi" })).row,
    ).toMatchObject({ budgetPreset: "5k_10k", joinByAt: JOIN_BY, giftDay: "2026-12-24", note: "Hi" });
    expect(parseDueRow(null).row).toBeNull();
  });
});
