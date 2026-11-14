import { describe, expect, it } from "vitest";
import { JOIN_COPY, UNAVAILABLE_COPY, joinedCountLine, unavailableBody } from "../../features/joining/copy.ts";
import { parseInvitePreview, parseJoinDetails } from "../../features/joining/parse.ts";
import { refusalFromHint, unavailableKindForJoin, unavailableKindFromStatus } from "../../features/joining/status.ts";
import { inviteJoinPath, inviteTokenFromNext, isInviteNext } from "../../lib/auth/invite-path.ts";
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

describe("destinationAfterVerify with an invite (owner decision Q1)", () => {
  it("sends an invitee straight to the join page, sign-up included (no Profile setup)", () => {
    expect(destinationAfterVerify({ flow: "signup", next: `/i/${TOKEN}/join` })).toBe(`/i/${TOKEN}/join`);
    expect(destinationAfterVerify({ flow: "login", next: `/i/${TOKEN}/join` })).toBe(`/i/${TOKEN}/join`);
  });
  it("sends a bare invite page to the join page", () => {
    expect(destinationAfterVerify({ flow: "signup", next: `/i/${TOKEN}` })).toBe(`/i/${TOKEN}/join`);
    expect(destinationAfterVerify({ flow: "login", next: `/i/${TOKEN}` })).toBe(`/i/${TOKEN}/join`);
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

describe("parseInvitePreview (GC-002: exactly the twelve keys, nothing else)", () => {
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
    });
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
  it("shows the preview only for an open invite", () => {
    expect(unavailableKindFromStatus("open")).toBeNull();
    expect(unavailableKindFromStatus("closed")).toBe("closed");
    expect(unavailableKindFromStatus("approval")).toBe("approval");
  });
  it("decides the join page", () => {
    const base = parseJoinDetails(joinRaw);
    expect(base).not.toBeNull();
    if (!base) return;
    expect(unavailableKindForJoin(null)).toBe("incorrect");
    expect(unavailableKindForJoin(base)).toBeNull();
    expect(unavailableKindForJoin({ ...base, status: "full" })).toBe("full");
    expect(unavailableKindForJoin({ ...base, viewer: "removed" })).toBe("removed");
    expect(unavailableKindForJoin({ ...base, viewer: "removed", status: "closed" })).toBe("removed");
  });
});

describe("copy", () => {
  it("writes the joined-count line (0, 1, many)", () => {
    expect(joinedCountLine(0)).toBe("You'd be one of the first to join.");
    expect(joinedCountLine(1)).toBe("1 person has joined so far.");
    expect(joinedCountLine(5)).toBe("5 people have joined so far.");
  });
  it("writes the people line and the stack label as the board does", () => {
    const people = [
      { name: "Ngozi Eze", isOrganiser: true },
      { name: "Femi Adeyemi", isOrganiser: false },
      { name: "Bisi Lawal", isOrganiser: false },
    ];
    expect(JOIN_COPY.peopleLine(people)).toBe("Ngozi Eze (organising), Femi Adeyemi and Bisi Lawal.");
    expect(JOIN_COPY.stackLabel(people)).toBe("3 people are in: Ngozi Eze (organising), Femi Adeyemi and Bisi Lawal");
    expect(JOIN_COPY.stackLabel(people.slice(0, 1))).toBe("1 person is in: Ngozi Eze (organising)");
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
  it("never offers Ask to join, which is slice 6", () => {
    for (const kind of ["closed", "cancelled", "full", "approval", "removed"] as const) {
      const body = unavailableBody(kind, { who: "Dayo", exchangeName: "X", day: "Mon 2 Nov" });
      expect(body).not.toMatch(/ask to/i);
    }
  });
});
