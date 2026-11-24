import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { budgetLabel, BUDGET_PRESETS } from "../../lib/money/budget.ts";
import { formatDayTime, zoneShortName, formatDay } from "../../lib/dates/format.ts";
import { budgetText, formatGiftDay, formatMoment } from "../../supabase/functions/_shared/emails/dates.ts";
import { escapeHtml, firstName, oneLine } from "../../supabase/functions/_shared/emails/escape.ts";
import { cleanBaseUrl, exchangeLink, inviteLink, notificationsLink, participantsLink, recipientLink, revealLink } from "../../supabase/functions/_shared/emails/links.ts";
import { renderEmail } from "../../supabase/functions/_shared/emails/render.ts";
import { EMAIL_TEMPLATES, type EmailTemplate, type RenderInput } from "../../supabase/functions/_shared/emails/types.ts";
import { bearerToken, secretsMatch } from "../../supabase/functions/send-emails/auth.ts";
import { parseDueRow, runSender, type Ports } from "../../supabase/functions/send-emails/process.ts";

const BASE = "https://unwrap.ink";
const EX = "0b9d6e0e-6b4b-4a3c-9d57-1d3f6a1d2c11";
const JOIN_BY = "2026-11-27T17:00:00Z";
const TOKEN = "0123456789abcdef0123456789abcdef";

const noOther = (t: EmailTemplate) => ["E09", "E12", "E15", "E21", "E23", "E24"].includes(t);
const hasDetails = (t: EmailTemplate) => t === "E06" || t === "E19" || t === "E21" || t === "E24";

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
    budgetPreset: hasDetails(template) ? "10k_20k" : null,
    joinByAt: template === "E06" || template === "E15" || template === "E23" ? JOIN_BY : null,
    giftDay: hasDetails(template) ? "2026-12-24" : null,
    note: template === "E06" ? "Let's keep it fun this year." : null,
    scheduleMode: template === "E10" ? "at_join_by" : null,
    scheduleAt: template === "E10" ? JOIN_BY : null,
    peopleCount: template === "E21" ? 6 : template === "E15" ? 2 : null,
    revealed: template === "E24" ? false : null,
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
      // WHY E10 may say "reminder": its board footer is "{Organiser} sent you a reminder in {exchange}" (the nudge
      // itself); the other templates promise none, and no template links to unsubscribe or settings it lacks.
      const banned = template === "E10" ? /stop invite emails|unsubscribe|auto-?close|Wishlists in/i : /stop invite emails|unsubscribe|reminder|auto-?close|Wishlists in/i;
      for (const out of [html, text]) {
        expect(out).not.toMatch(banned);
      }
    }
  });

  it("E07 and E08 carry the settings link, and E06, E09 and E12 do not", () => {
    const settings = `${BASE}/profile/notifications`;
    expect(renderEmail(input("E07"), BASE).html).toContain(settings);
    expect(renderEmail(input("E08"), BASE).html).toContain(settings);
    for (const template of ["E06", "E09", "E10", "E12"] as const) {
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
    expect(renderEmail(input("E10"), BASE).subject).toBe("Chidi is waiting on your wishlist");
  });
});

describe("E10 Nudge (GCO-008, board Email-E10)", () => {
  it("is the board's email for an automatic draw, in the recipient's zone", () => {
    const { subject, preview, html, text } = renderEmail(input("E10"), BASE);
    expect(subject).toBe("Chidi is waiting on your wishlist");
    expect(preview).toBe("Add it before names are drawn on Fri 27 Nov, 6:00 pm WAT.");
    for (const out of [html, text]) {
      expect(out).toContain("Add your wishlist for Family Christmas 2026");
      expect(out).toContain("Hi Tolu,");
      expect(out).toContain("Chidi is waiting on your wishlist for Family Christmas 2026. Names are drawn on Fri 27 Nov, 6:00 pm WAT.");
      expect(out).toContain("A wishlist gives whoever draws your name a few ideas, so you get something you&#39;ll actually like. Only they will see it.".replace("&#39;", out === text ? "'" : "&#39;"));
      expect(out).toContain("You&#39;re getting this because Chidi sent you a reminder in Family Christmas 2026.".replace("&#39;", out === text ? "'" : "&#39;"));
    }
    expect(html).toContain("Add my wishlist");
    expect(html).toContain(`${BASE}/exchanges/${EX}`);
  });

  it("says when the organiser is ready for a manual draw, with no day", () => {
    const { preview, html } = renderEmail(input("E10", { scheduleMode: "organiser_chooses", scheduleAt: null }), BASE);
    expect(html).toContain("Names are drawn when Chidi is ready.");
    expect(html).not.toMatch(/Names are drawn on/);
    expect(preview).not.toMatch(/Fri|Nov/);
  });

  it("falls back to 'The organiser' when the name is gone, and never throws on a bad date", () => {
    const { subject, html } = renderEmail(input("E10", { otherName: null, scheduleAt: "garbage" }), BASE);
    expect(subject).toBe("The organiser is waiting on your wishlist");
    expect(html).toContain("Names are drawn when The organiser is ready.");
  });

  it("escapes the organiser's name and the exchange name", () => {
    const { html } = renderEmail(input("E10", { otherName: "<i>Amaka</i> Obi", exchangeName: "<b>X</b>" }), BASE);
    expect(html).not.toContain("<i>Amaka");
    expect(html).not.toContain("<b>X");
  });

  it("has no unsubscribe or settings link and prints no address", () => {
    const { html, text } = renderEmail(input("E10"), BASE);
    expect(html + text).not.toMatch(/unsubscribe|notifications/i);
    expect([...(html + text).matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)]).toEqual([]);
  });

  it("the sender reads the schedule from the claim for E10", () => {
    const parsed = parseDueRow({
      id: "r1", template: "E10", to_email: "tolu@example.com", to_name: "Tolu Adeyemi", to_timezone: "Africa/Lagos",
      exchange_id: EX, exchange_name: "Family Christmas 2026", other_name: "Chidi Okeke", attempts: 0,
      draw_mode: "at_join_by", draw_at: JOIN_BY,
    });
    expect(parsed.row?.scheduleMode).toBe("at_join_by");
    expect(parsed.row?.scheduleAt).toBe(JOIN_BY);
  });
});

describe("E19 and E21 Names are drawn (GCO-012, boards Email-E19 and Email-E21)", () => {
  it("E19 is the board's email and links to Reveal", () => {
    const { subject, preview, html, text } = renderEmail(input("E19"), BASE);
    expect(subject).toBe("Names are drawn for Family Christmas 2026");
    expect(preview).toBe("Find out who you're buying for. Only you will see it.");
    expect(html).toContain("Names have been drawn for Family Christmas 2026. Open Unwrap to see who you&#39;re buying for. Only you will see it, not even Chidi.");
    expect(html).toContain("Budget per gift");
    expect(html).toContain("Thu 24 Dec");
    expect(html).toContain("Reveal who you got");
    expect(html).toContain(`href="${revealLink(BASE, EX)}"`);
    expect(html).toContain("Tip: make sure nobody&#39;s looking over your shoulder.");
    expect(html).toContain(`${BASE}/profile/notifications`);
    expect(text).toContain("Reveal who you got: " + revealLink(BASE, EX));
  });

  it("E19 to the organiser says only 'Only you will see it.'", () => {
    const { html } = renderEmail(input("E19", { toName: "Chidi Okeke", otherName: "Chidi Okeke" }), BASE);
    expect(html).toContain("Only you will see it.");
    expect(html).not.toContain("not even");
  });

  it("E21 links to the exchange and never claims a count of people told", () => {
    const { subject, preview, html } = renderEmail(input("E21"), BASE);
    expect(subject).toBe("Names are drawn for Family Christmas 2026");
    expect(preview).toBe("Everyone has someone to buy for.");
    expect(html).toContain("Everyone taking part has someone to buy for.");
    expect(html).not.toContain("have been told");
    expect(html).not.toContain("All 6 people");
    expect(html).toContain("Nobody can see who got whom, not even you.");
    expect(html).toContain("View exchange");
    expect(html).toContain(`href="${exchangeLink(BASE, EX)}"`);
    expect(html).not.toContain("/reveal");
  });

  it("E21 reads the same without a count", () => {
    const { html } = renderEmail(input("E21", { peopleCount: null }), BASE);
    expect(html).toContain("Everyone taking part has someone to buy for.");
  });

  it("the sender reads the people count from the claim", () => {
    const parsed = parseDueRow({
      id: "r1", template: "E21", to_email: "chidi@example.com", to_name: "Chidi Okeke", to_timezone: "Africa/Lagos",
      exchange_id: EX, exchange_name: "Family Christmas 2026", attempts: 0, budget_preset: "10k_20k", gift_day: "2026-12-24",
      people_count: 6,
    });
    expect(parsed.row?.peopleCount).toBe(6);
    expect(parsed.row?.budgetPreset).toBe("10k_20k");
  });
});

describe("E15, E23 and E24 (slice 12; boards Email-E15, -E23, -E24)", () => {
  const FORGE = "Forged Person";
  // WHY: the layout escapes an apostrophe as &#39;, so compare the readable text.
  const readable = (html: string) => html.replace(/&#39;/g, "'");

  it("E15 for too few people is the board's body, in the organiser's zone, without a retry promise", () => {
    const { subject, preview, html, text } = renderEmail(input("E15"), BASE);
    expect(subject).toBe("Names couldn't be drawn for Family Christmas 2026");
    expect(preview).toBe("No names were drawn.");
    for (const out of [readable(html), text]) {
      expect(out).toContain("We couldn't draw names");
      expect(out).toContain("Hi Tolu,");
      expect(out).toContain(
        "We tried to draw names for Family Christmas 2026 at Fri 27 Nov, 6:00 pm WAT, but couldn't. Only 2 people are taking part, and a draw needs at least 3.",
      );
      expect(out).not.toMatch(/try again|we'll try|later/i);
    }
    expect(html).toContain(`href="${exchangeLink(BASE, EX)}"`);
    expect(html).toContain("View exchange");
  });

  it("E15 switches on the count: 3 or more means the exclusions wording", () => {
    const { html, text } = renderEmail(input("E15", { peopleCount: 3 }), BASE);
    expect(readable(html)).toContain("With the exclusion pairs you set, there's no way to give everyone a person.");
    expect(html).toContain("Fix the draw");
    expect(html).not.toMatch(/Only \d|at least 3/);
    expect(text).not.toContain("Only 3");
  });

  it("E15 reads well for nobody, one person and an unknown count or time", () => {
    expect(renderEmail(input("E15", { peopleCount: 0 }), BASE).html).toContain("Nobody is taking part, and a draw needs at least 3 people.");
    expect(renderEmail(input("E15", { peopleCount: 1 }), BASE).html).toContain("Only 1 person is taking part, and a draw needs at least 3.");
    expect(renderEmail(input("E15", { peopleCount: null }), BASE).html).toContain("Not enough people are taking part");
    expect(readable(renderEmail(input("E15", { joinByAt: "garbage" }), BASE).html)).toContain(
      "We tried to draw names for Family Christmas 2026, but couldn't.",
    );
  });

  it("E15 is always sent: no settings or unsubscribe link, and it shows the draw time in the reader's own zone", () => {
    const { html, text } = renderEmail(input("E15", { toTimezone: "Europe/London" }), BASE);
    expect(html + text).not.toMatch(/notifications|unsubscribe|Manage email settings/i);
    expect(html).toContain("Fri 27 Nov, 5:00 pm GMT");
  });

  it("E23 is the board's email: join-by in the reader's zone with its label, link to the exchange, settings link", () => {
    const { subject, preview, html, text } = renderEmail(input("E23"), BASE);
    const out = readable(html);
    expect(subject).toBe("Add your wishlist before tomorrow");
    expect(preview).toBe("Joining for Family Christmas 2026 closes Fri 27 Nov, 6:00 pm WAT.");
    expect(out).toContain("One day left to add your wishlist");
    expect(out).toContain("Joining for Family Christmas 2026 closes on Fri 27 Nov, 6:00 pm WAT, and you haven't added a wishlist yet.");
    expect(out).toContain("Add a few ideas so whoever draws your name knows what you'd like. It takes a minute, and only they will see it.");
    expect(out).toContain("Add my wishlist");
    expect(out).toContain(`href="${exchangeLink(BASE, EX)}"`);
    expect(out).toContain("You're getting this because you're taking part in Family Christmas 2026 and haven't added a wishlist.");
    expect(out).toContain(`${BASE}/profile/notifications`);
    expect(text).toContain("Manage email settings: " + notificationsLink(BASE));
  });

  it("E23 shows the join-by moment in each reader's zone", () => {
    expect(renderEmail(input("E23", { toTimezone: "America/New_York" }), BASE).html).toContain("Fri 27 Nov, 12:00 pm GMT-5");
    expect(renderEmail(input("E23", { toTimezone: "Pacific/Auckland" }), BASE).html).toMatch(/Sat 28 Nov, 6:00 am /);
    expect(readable(renderEmail(input("E23", { joinByAt: null }), BASE).html)).toContain("closes soon, and you haven't");
  });

  it("E24 shows the gift day as stored and the budget, whatever the zone", () => {
    for (const zone of ["Pacific/Auckland", "America/Los_Angeles", "Africa/Lagos"]) {
      const { subject, preview, html } = renderEmail(input("E24", { toTimezone: zone }), BASE);
      expect(subject).toBe("Gifts are exchanged tomorrow");
      expect(preview).toBe("Family Christmas 2026 is on Thu 24 Dec.");
      expect(readable(html)).toContain("It's nearly gift day");
      expect(html).toContain("Family Christmas 2026 is tomorrow, Thu 24 Dec. Time to make sure your gift is ready.");
      expect(html).toContain("₦10,000 to ₦20,000");
      expect(html).toContain(">Thu 24 Dec<");
    }
  });

  it("E24 sends a person who has opened who they got to the wishlist, anyone else to Reveal", () => {
    const seen = renderEmail(input("E24", { revealed: true }), BASE);
    expect(seen.html).toContain("View their wishlist");
    expect(seen.html).toContain(`href="${recipientLink(BASE, EX)}"`);
    expect(seen.html).not.toContain("Reveal who you got");
    for (const revealed of [false, null]) {
      const unseen = renderEmail(input("E24", { revealed }), BASE);
      expect(unseen.html).toContain("Reveal who you got");
      expect(unseen.html).toContain(`href="${revealLink(BASE, EX)}"`);
      expect(unseen.html).not.toContain("View their wishlist");
    }
  });

  it("E24 carries a settings link and says nothing about who gives to whom", () => {
    const { html, text, subject, preview } = renderEmail(input("E24", { revealed: true }), BASE);
    expect(html).toContain(`${BASE}/profile/notifications`);
    for (const out of [html, text, subject, preview]) expect(out).not.toMatch(/buying for|you got [A-Z]|your person/i);
  });

  it("a hostile other name never reaches E15, E23 or E24: the only person in them is the reader", () => {
    for (const template of ["E15", "E23", "E24"] as const) {
      const out = renderEmail(input(template, { otherName: FORGE }), BASE);
      for (const part of Object.values(out)) expect(part).not.toContain(FORGE);
    }
  });

  it("the sender reads the new claim columns, and all three codes are known (no unknown_template)", () => {
    const row = {
      id: "r1", to_email: "tolu@example.com", to_name: "Tolu Adeyemi", to_timezone: "Africa/Lagos", exchange_id: EX,
      exchange_name: "Family Christmas 2026", attempts: 0,
    };
    for (const template of ["E15", "E23", "E24"]) expect(parseDueRow({ ...row, template }).code).toBe("");
    expect(parseDueRow({ ...row, template: "E24", revealed: true, gift_day: "2026-12-24", budget_preset: "10k_20k" }).row).toMatchObject({
      revealed: true, giftDay: "2026-12-24", budgetPreset: "10k_20k",
    });
    expect(parseDueRow({ ...row, template: "E15", people_count: 2, join_by_at: JOIN_BY }).row).toMatchObject({ peopleCount: 2, joinByAt: JOIN_BY });
    expect(parseDueRow({ ...row, template: "E24", revealed: "yes" }).row?.revealed).toBeNull();
  });

  it("the codes match the database check on email_outbox.template", () => {
    const sql = readFileSync("supabase/migrations/20261124192342_scheduled_jobs.sql", "utf8");
    const check = /check \(template in \(([^)]*)\)\)/.exec(sql)?.[1] ?? "";
    const codes = [...check.matchAll(/'(E\d+)'/g)].map((m) => m[1]).sort();
    expect(codes).toEqual([...EMAIL_TEMPLATES].sort());
  });

  it("a sender run sends each of them", async () => {
    const dbRow = (id: string, template: string) => ({
      id, template, to_email: "tolu@example.com", to_name: "Tolu Adeyemi", to_timezone: "Africa/Lagos", exchange_id: EX,
      exchange_name: "Family Christmas 2026", attempts: 0, join_by_at: JOIN_BY, gift_day: "2026-12-24", budget_preset: "10k_20k",
      people_count: 2, revealed: false,
    });
    const marks: Array<[string, string | null]> = [];
    const summary = await runSender({
      appBaseUrl: BASE,
      claim: async () => [dbRow("a", "E15"), dbRow("b", "E23"), dbRow("c", "E24")],
      mark: async (id, code) => {
        marks.push([id, code]);
      },
      send: async () => ({ ok: true }),
    });
    expect(summary).toEqual({ claimed: 3, sent: 3, failed: 0 });
    expect(marks.every(([, code]) => code === null)).toBe(true);
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
