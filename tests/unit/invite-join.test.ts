import { describe, expect, it } from "vitest";
import { INVITE_COPY, JOIN_COPY, REQUEST_COPY, UNAVAILABLE_COPY, joinedCountLine, unavailableBody } from "../../features/joining/copy.ts";
import { parseInvitePreview, parseJoinDetails } from "../../features/joining/parse.ts";
import { decideInviteView, refusalFromHint, requestRefusalFromHint } from "../../features/joining/status.ts";
import { inviteJoinPath, inviteTokenFromNext, isInviteNext } from "../../lib/auth/invite-path.ts";
import { JOIN_INTENT_COOKIE, JOIN_INTENT_MAX_AGE_S, joinIntentMatches, joinIntentPath } from "../../lib/auth/join-intent.ts";
import { destinationAfterVerify } from "../../lib/auth/verify-state.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";

const previewRaw = {
  status: "open",
  exchange_name: "Family Christmas 2026",
  tint: "clay",
  inviter_name: "Amaka Obi",
  budget_preset: "10k_20k",
  join_by_at: "2026-11-27T17:00:00+00:00",
  gift_day: "2026-12-24",
  joined_count: 5,
  closed_at: null,
  cancelled_at: null,
  draw_mode: "at_join_by",
  draw_at: "2026-11-27T17:00:00+00:00",
  can_ask: false,
};

const joinRaw = {
  status: "open",
  viewer: "can_join",
  exchange_id: null,
  exchange_name: "Church choir Kris Kringle",
  tint: "mint",
  organiser_name: "Ngozi Eze",
  budget_preset: "5k_10k",
  join_by_at: "2026-11-27T17:00:00+00:00",
  draw_mode: "at_join_by",
  draw_at: "2026-11-27T17:00:00+00:00",
  gift_day: "2026-12-20",
  note: "Keep it thoughtful.",
  people: [
    { name: "Ngozi Eze", is_organiser: true },
    { name: "Femi Adeyemi", is_organiser: false },
  ],
  can_ask: false,
};

describe("inviteTokenFromNext (GC-003, GC-004: only an exact invite path is an invite)", () => {
  it("accepts the invite page and the join page", () => {
    expect(inviteTokenFromNext(`/i/${TOKEN}`)).toBe(TOKEN);
    expect(inviteTokenFromNext(`/i/${TOKEN}/join`)).toBe(TOKEN);
    expect(isInviteNext(`/i/${TOKEN}/join`)).toBe(true);
  });
  it.each([
    undefined,
    null,
    "",
    "/i/abc",
    `/i/${TOKEN.toUpperCase()}`,
    `/i/${TOKEN}0`,
    `/i/${TOKEN.slice(1)}`,
    `/i/${TOKEN}/`,
    `/i/${TOKEN}/join/`,
    `/i/${TOKEN}/joinx`,
    `/i/${TOKEN}?x=1`,
    `/i/${TOKEN}#x`,
    `/i/${TOKEN}/other`,
    `//i/${TOKEN}`,
    ` /i/${TOKEN}`,
    `/i/${TOKEN}\n`,
    `https://evil.example/i/${TOKEN}`,
    "/exchanges/1",
  ])("refuses %j", (value) => {
    expect(inviteTokenFromNext(value)).toBeNull();
  });
  it("builds the join path", () => {
    expect(inviteJoinPath(TOKEN)).toBe(`/i/${TOKEN}/join`);
  });
});

describe("destinationAfterVerify with an invite (join-one-screen, owner decision 2, 2026-11-18)", () => {
  it("sends a new invitee through the name step and back to the join action page", () => {
    const joinPath = `/i/${TOKEN}/join`;
    expect(destinationAfterVerify({ flow: "signup", next: joinPath })).toBe(`/welcome?next=${encodeURIComponent(joinPath)}`);
  });
  it("sends a returning invitee straight to the join action page", () => {
    expect(destinationAfterVerify({ flow: "login", next: `/i/${TOKEN}/join` })).toBe(`/i/${TOKEN}/join`);
  });
  it("treats a bare invite page the same way", () => {
    const joinPath = `/i/${TOKEN}/join`;
    expect(destinationAfterVerify({ flow: "signup", next: `/i/${TOKEN}` })).toBe(`/welcome?next=${encodeURIComponent(joinPath)}`);
    expect(destinationAfterVerify({ flow: "login", next: `/i/${TOKEN}` })).toBe(joinPath);
  });
  it("still sends a Landing sign-up to Profile setup", () => {
    expect(destinationAfterVerify({ flow: "signup" })).toBe("/welcome");
  });
  it("still sends a sign-up with any other deep link through Profile setup", () => {
    expect(destinationAfterVerify({ flow: "signup", next: "/exchanges/1" })).toBe("/welcome?next=%2Fexchanges%2F1");
    expect(destinationAfterVerify({ flow: "signup", next: "/i/abc" })).toBe("/welcome?next=%2Fi%2Fabc");
    expect(destinationAfterVerify({ flow: "signup", next: `/i/${TOKEN}/other` })).toBe(`/welcome?next=${encodeURIComponent(`/i/${TOKEN}/other`)}`);
  });
});

describe("parseInvitePreview (GC-002: exactly the thirteen keys, nothing else)", () => {
  it("reads the payload", () => {
    expect(parseInvitePreview(previewRaw)).toEqual({
      status: "open",
      exchangeName: "Family Christmas 2026",
      tint: "clay",
      inviterName: "Amaka Obi",
      budget: "10k_20k",
      joinByAt: "2026-11-27T17:00:00+00:00",
      giftDay: "2026-12-24",
      joinedCount: 5,
      closedAt: null,
      cancelledAt: null,
      drawMode: "at_join_by",
      drawAt: "2026-11-27T17:00:00+00:00",
      canAsk: false,
    });
  });
  it("reads can_ask true on a closed payload and refuses a non-boolean", () => {
    expect(parseInvitePreview({ ...previewRaw, status: "closed", closed_at: "2026-11-02T10:00:00Z", can_ask: true })?.canAsk).toBe(true);
    expect(parseInvitePreview({ ...previewRaw, can_ask: "yes" })).toBeNull();
    expect(parseInvitePreview({ ...previewRaw, can_ask: null })).toBeNull();
  });
  it("refuses a payload without can_ask (the old twelve keys)", () => {
    const rest: Record<string, unknown> = { ...previewRaw };
    delete rest.can_ask;
    expect(parseInvitePreview(rest)).toBeNull();
  });
  it("reads an organiser-draws payload", () => {
    const p = parseInvitePreview({ ...previewRaw, draw_mode: "organiser_chooses", draw_at: null });
    expect(p?.drawMode).toBe("organiser_chooses");
    expect(p?.drawAt).toBeNull();
  });
  it("reads a closed and a cancelled payload", () => {
    expect(parseInvitePreview({ ...previewRaw, status: "closed", closed_at: "2026-11-02T10:00:00Z" })?.closedAt).toBe("2026-11-02T10:00:00Z");
    expect(parseInvitePreview({ ...previewRaw, status: "cancelled", cancelled_at: "2026-11-01T10:00:00Z" })?.cancelledAt).toBe("2026-11-01T10:00:00Z");
  });
  it("refuses an unknown key (for example an id or the note)", () => {
    expect(parseInvitePreview({ ...previewRaw, note: "x" })).toBeNull();
    expect(parseInvitePreview({ ...previewRaw, exchange_id: "x" })).toBeNull();
  });
  it("refuses a missing key, null and non-objects", () => {
    const rest: Record<string, unknown> = { ...previewRaw };
    delete rest.joined_count;
    expect(parseInvitePreview(rest)).toBeNull();
    expect(parseInvitePreview(null)).toBeNull();
    expect(parseInvitePreview([])).toBeNull();
    expect(parseInvitePreview("x")).toBeNull();
  });
  it.each([
    ["status", "gone"],
    ["tint", "red"],
    ["budget_preset", "1m"],
    ["join_by_at", "not a date"],
    ["gift_day", "24 Dec"],
    ["joined_count", "5"],
    ["joined_count", -1],
    ["joined_count", 1.5],
    ["inviter_name", ""],
    ["exchange_name", 7],
    ["closed_at", "nope"],
    ["draw_mode", "random"],
    ["draw_at", "nope"],
  ])("refuses a wrong %s (%j)", (key, value) => {
    expect(parseInvitePreview({ ...previewRaw, [key]: value })).toBeNull();
  });
});

describe("parseJoinDetails (GC-009: names only, an id only for a member)", () => {
  it("reads the payload", () => {
    const parsed = parseJoinDetails(joinRaw);
    expect(parsed?.people).toEqual([
      { name: "Ngozi Eze", isOrganiser: true },
      { name: "Femi Adeyemi", isOrganiser: false },
    ]);
    expect(parsed?.exchangeId).toBeNull();
    expect(parsed?.viewer).toBe("can_join");
    expect(parsed?.note).toBe("Keep it thoughtful.");
  });
  it("reads a member with an id and a manual draw with no note", () => {
    const id = "0b2a8b0e-3c1f-4c7b-9a43-0d2f6a1e7b11";
    const parsed = parseJoinDetails({ ...joinRaw, viewer: "member", exchange_id: id, draw_mode: "organiser_chooses", draw_at: null, note: null });
    expect(parsed?.exchangeId).toBe(id);
    expect(parsed?.drawAt).toBeNull();
    expect(parsed?.note).toBeNull();
  });
  it("reads every viewer, including a pending request, and can_ask", () => {
    for (const viewer of ["can_join", "removed", "requested"]) expect(parseJoinDetails({ ...joinRaw, viewer })?.viewer).toBe(viewer);
    expect(parseJoinDetails({ ...joinRaw, can_ask: true })?.canAsk).toBe(true);
    expect(parseJoinDetails({ ...joinRaw, viewer: "requested" })?.exchangeId).toBeNull();
  });
  it("refuses a payload without can_ask or with a non-boolean one", () => {
    const rest: Record<string, unknown> = { ...joinRaw };
    delete rest.can_ask;
    expect(parseJoinDetails(rest)).toBeNull();
    expect(parseJoinDetails({ ...joinRaw, can_ask: 1 })).toBeNull();
  });
  it("refuses an id for a non-member and no id for a member", () => {
    expect(parseJoinDetails({ ...joinRaw, exchange_id: "0b2a8b0e-3c1f-4c7b-9a43-0d2f6a1e7b11" })).toBeNull();
    expect(parseJoinDetails({ ...joinRaw, viewer: "member" })).toBeNull();
  });
  it("refuses unknown keys on the payload and on a person (an email, a user id, a list status)", () => {
    expect(parseJoinDetails({ ...joinRaw, organiser_email: "a@b.co" })).toBeNull();
    expect(parseJoinDetails({ ...joinRaw, people: [{ name: "A", is_organiser: true, user_id: "x" }] })).toBeNull();
    expect(parseJoinDetails({ ...joinRaw, people: [{ name: "A", is_organiser: true, has_list: true }] })).toBeNull();
  });
  it("refuses wrong types", () => {
    expect(parseJoinDetails({ ...joinRaw, viewer: "owner" })).toBeNull();
    expect(parseJoinDetails({ ...joinRaw, draw_mode: "random" })).toBeNull();
    expect(parseJoinDetails({ ...joinRaw, people: "x" })).toBeNull();
    expect(parseJoinDetails({ ...joinRaw, people: [{ name: "A", is_organiser: "yes" }] })).toBeNull();
    expect(parseJoinDetails({ ...joinRaw, note: 3 })).toBeNull();
    expect(parseJoinDetails(null)).toBeNull();
  });
});

describe("status mapping (GC-012)", () => {
  it("maps a join refusal hint, and ignores anything else", () => {
    for (const hint of ["closed", "cancelled", "full", "removed", "approval"]) expect(refusalFromHint(hint)).toBe(hint);
    expect(refusalFromHint("complete")).toBeNull();
    expect(refusalFromHint(null)).toBeNull();
    expect(refusalFromHint(undefined)).toBeNull();
  });
  it("maps a request refusal hint, and ignores anything else", () => {
    for (const hint of ["member", "cancelled", "closed", "full", "can_join"]) expect(requestRefusalFromHint(hint)).toBe(hint);
    expect(requestRefusalFromHint("removed")).toBeNull();
    expect(requestRefusalFromHint("approval")).toBeNull();
    expect(requestRefusalFromHint(null)).toBeNull();
    expect(requestRefusalFromHint(undefined)).toBeNull();
  });
});

describe("decideInviteView (GC-002, GC-009, GC-012)", () => {
  const v = (status: "open" | "closed" | "cancelled" | "full" | "approval", viewer: "member" | "can_join" | "removed" | "requested" | null, canAsk: boolean) =>
    decideInviteView({ status, viewer, canAsk });

  it("joins an open invite", () => {
    expect(v("open", "can_join", false)).toEqual({ view: "join" });
    expect(v("open", null, false)).toEqual({ view: "join" });
  });
  it("asks on an approval exchange, and never lets the person join directly", () => {
    expect(v("approval", "can_join", true)).toEqual({ view: "ask-confirm" });
    expect(v("approval", null, true)).toEqual({ view: "ask-confirm" });
  });
  it("asks after joining closed when a request is allowed, and is S13 when it is not", () => {
    expect(v("closed", "can_join", true)).toEqual({ view: "ask-closed" });
    expect(v("closed", null, true)).toEqual({ view: "ask-closed" });
    expect(v("closed", "can_join", false)).toEqual({ view: "unavailable", kind: "closed" });
  });
  it("shows a removed person Ask to join while asking is allowed, otherwise S13", () => {
    expect(v("open", "removed", true)).toEqual({ view: "ask-removed" });
    expect(v("approval", "removed", true)).toEqual({ view: "ask-removed" });
    expect(v("closed", "removed", true)).toEqual({ view: "ask-removed" });
    expect(v("closed", "removed", false)).toEqual({ view: "unavailable", kind: "closed" });
    expect(v("open", "removed", false)).toEqual({ view: "unavailable", kind: "incorrect" });
  });
  it("never offers Ask when cancelled or full", () => {
    for (const viewer of ["can_join", "removed", null] as const) {
      expect(v("cancelled", viewer, true)).toEqual({ view: "unavailable", kind: "cancelled" });
      expect(v("full", viewer, true)).toEqual({ view: "unavailable", kind: "full" });
    }
  });
  it("says pending when the viewer already asked, whatever can_ask says", () => {
    for (const status of ["open", "approval", "closed"] as const) {
      expect(v(status, "requested", true)).toEqual({ view: "pending" });
      expect(v(status, "requested", false)).toEqual({ view: "pending" });
    }
  });
  it("sends a member on to the exchange first", () => {
    expect(v("closed", "member", true)).toEqual({ view: "member" });
    expect(v("approval", "member", false)).toEqual({ view: "member" });
  });
});

describe("copy", () => {
  it("writes the joined-count line (0, 1, many)", () => {
    expect(joinedCountLine(0)).toBe("You'd be one of the first to join.");
    expect(joinedCountLine(1)).toBe("1 person has joined so far.");
    expect(joinedCountLine(5)).toBe("5 people have joined so far.");
  });
  it("writes the board's first-name line and the how-it-works steps", () => {
    const first = (n: number) => ["Ngozi Eze", "Femi Adeyemi", "Bisi Lawal", "Chinedu Okoro", "Yemi Ojo", "Tobi Ade", "Sade Bello"].slice(0, n).map((name) => ({ name, isOrganiser: false }));
    expect(JOIN_COPY.inLine(first(1))).toBe("Ngozi is in.");
    expect(JOIN_COPY.inLine(first(3))).toBe("Ngozi, Femi and Bisi are in.");
    expect(JOIN_COPY.inLine(first(5))).toBe("Ngozi, Femi, Bisi, Chinedu and Yemi are in.");
    expect(JOIN_COPY.inLine(first(7))).toBe("Ngozi, Femi, Bisi, Chinedu, Yemi and 2 others are in.");
    expect(INVITE_COPY.how.drawn("Fri 27 Nov")).toBe("On Fri 27 Nov we draw names. Only you see who you're buying for.");
    expect(INVITE_COPY.how.buy("₦5,000 to ₦10,000", "Sun 20 Dec")).toBe("Buy one gift within ₦5,000 to ₦10,000 and bring it on Sun 20 Dec.");
    expect(INVITE_COPY.emailLine("Ngozi")).toBe("Ngozi, the organiser, can see your email address.");
    expect(INVITE_COPY.giftsExchanged).toBe("Gifts exchanged");
  });
  it("writes the people line and the stack label as the board does", () => {
    const people = [
      { name: "Ngozi Eze", isOrganiser: true },
      { name: "Femi Adeyemi", isOrganiser: false },
      { name: "Bisi Lawal", isOrganiser: false },
    ];
    expect(JOIN_COPY.peopleLine(people)).toBe("Ngozi Eze, Femi Adeyemi and Bisi Lawal.");
    expect(JOIN_COPY.stackLabel(people)).toBe("3 people are in: Ngozi Eze, Femi Adeyemi and Bisi Lawal");
    expect(JOIN_COPY.stackLabel(people.slice(0, 1))).toBe("1 person is in: Ngozi Eze");
  });
  it("writes each unavailable line, with the day for closed and cancelled", () => {
    const facts = { who: "Dayo Ade", exchangeName: "Cousins' Christmas 2026", day: "Mon 2 Nov" };
    expect(unavailableBody("closed", facts)).toBe("Dayo closed joining for 'Cousins' Christmas 2026' on Mon 2 Nov.");
    expect(unavailableBody("cancelled", { ...facts, day: "Sun 1 Nov" })).toBe("Dayo cancelled 'Cousins' Christmas 2026' on Sun 1 Nov.");
    expect(unavailableBody("closed", { ...facts, day: null })).toBe("Dayo closed joining for 'Cousins' Christmas 2026'.");
    expect(unavailableBody("incorrect", facts)).toBe(UNAVAILABLE_COPY.incorrect);
  });
  it("falls back to the incorrect line when the facts are missing", () => {
    expect(unavailableBody("closed", { who: null, exchangeName: null, day: null })).toBe(UNAVAILABLE_COPY.incorrect);
  });
  it("writes the Ask to join lines as the boards do", () => {
    expect(REQUEST_COPY.approvalLine("Ngozi")).toBe("Ngozi approves everyone who joins, so this sends a request. Nobody else is told.");
    expect(REQUEST_COPY.stillAsk("Dayo")).toBe("You can still ask to be let in. Dayo decides.");
    expect(REQUEST_COPY.failed).toBe("We couldn't send your request. Nothing was sent, so you can try again.");
    expect(REQUEST_COPY.pending("'Cousins' Christmas 2026'", "Dayo")).toBe("Your request to join 'Cousins' Christmas 2026' is waiting for Dayo.");
    expect(REQUEST_COPY.waitingFor("Ngozi")).toBe("Waiting for Ngozi");
  });
  it("promises no email and no Home row anywhere in the request copy (owner decision Q6)", () => {
    const lines = [
      REQUEST_COPY.approvalLine("Ngozi"),
      REQUEST_COPY.stillAsk("Ngozi"),
      REQUEST_COPY.pending("X", "Ngozi"),
      REQUEST_COPY.sentBody("Ngozi"),
      REQUEST_COPY.removed("X"),
      REQUEST_COPY.goToExchanges,
    ];
    for (const line of lines) expect(line).not.toMatch(/email|home/i);
  });
});

describe("join intent (join-one-screen, owner approval R-2, 2026-11-18)", () => {
  it("is scoped to the one invite path, so another invite never sees it", () => {
    expect(joinIntentPath(TOKEN)).toBe(`/i/${TOKEN}`);
    expect(JOIN_INTENT_COOKIE).toBe("uw_join_intent");
  });
  it("lasts 30 minutes", () => {
    expect(JOIN_INTENT_MAX_AGE_S).toBe(30 * 60);
  });
  it("matches only its own token", () => {
    expect(joinIntentMatches(TOKEN, TOKEN)).toBe(true);
    expect(joinIntentMatches("b".repeat(32), TOKEN)).toBe(false);
    expect(joinIntentMatches(undefined, TOKEN)).toBe(false);
    expect(joinIntentMatches("", TOKEN)).toBe(false);
  });
});
