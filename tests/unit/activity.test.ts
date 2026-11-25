import { describe, expect, it } from "vitest";
import { dayLabel, groupByDay, toActivityItem } from "@/features/activity/group";
import { parseActivityRows, parseUnreadCount } from "@/features/activity/parse";
import type { ActivityRow } from "@/features/activity/types";

const ID = "11111111-1111-4111-8111-111111111111";
const EX = "22222222-2222-4222-8222-222222222222";

function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    kind: "member_joined",
    exchange_id: EX,
    exchange_name: "Family Christmas 2026",
    exchange_tint: "clay",
    subject_name: "Tolu Bello",
    created_at: "2026-11-14T17:40:00.123456+00:00",
    is_unread: false,
    ...overrides,
  };
}

function row(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: ID,
    kind: "member_joined",
    exchangeId: EX,
    exchangeName: "Family Christmas 2026",
    exchangeTint: "clay",
    subjectName: "Tolu Bello",
    createdAt: "2026-11-14T17:40:00+00:00",
    isUnread: false,
    ...overrides,
  };
}

describe("parseActivityRows (GC-006 S09)", () => {
  it("reads well-formed rows and keeps the time string as given", () => {
    const rows = parseActivityRows([raw(), raw({ id: "33333333-3333-4333-8333-333333333333", kind: "join_requested", is_unread: true })]);
    expect(rows).toHaveLength(2);
    expect(rows?.[0]).toMatchObject({ kind: "member_joined", subjectName: "Tolu Bello", createdAt: "2026-11-14T17:40:00.123456+00:00" });
    expect(rows?.[1]?.isUnread).toBe(true);
  });

  it("reads Names drawn, whose subject is null (GC-007)", () => {
    const rows = parseActivityRows([raw({ kind: "names_drawn", subject_name: null })]);
    expect(rows?.[0]?.kind).toBe("names_drawn");
    expect(rows?.[0]?.subjectName).toBe("");
  });

  it("refuses Names drawn with a subject, and a people event with none", () => {
    expect(parseActivityRows([raw({ kind: "names_drawn", subject_name: "Tolu Bello" })])).toBeNull();
    expect(parseActivityRows([raw({ kind: "member_joined", subject_name: null })])).toBeNull();
  });

  it.each(["join_by_reminder", "event_reminder", "exchange_completed"])("reads %s with no subject (GC-026, GCO-015)", (kind) => {
    const rows = parseActivityRows([raw({ kind, subject_name: null })]);
    expect(rows?.[0]?.kind).toBe(kind);
    expect(rows?.[0]?.subjectName).toBe("");
  });

  it.each(["join_by_reminder", "event_reminder", "exchange_completed"])("refuses %s with a subject", (kind) => {
    expect(parseActivityRows([raw({ kind, subject_name: "Tolu Bello" })])).toBeNull();
  });

  it("accepts an empty list", () => {
    expect(parseActivityRows([])).toEqual([]);
  });

  it("refuses anything that is not an array", () => {
    expect(parseActivityRows(null)).toBeNull();
    expect(parseActivityRows({})).toBeNull();
    expect(parseActivityRows("rows")).toBeNull();
  });

  it("refuses a row with an extra key, such as a user id", () => {
    expect(parseActivityRows([raw({ subject_user_id: ID })])).toBeNull();
  });

  it("refuses a row with a missing key", () => {
    const incomplete = raw();
    delete incomplete.is_unread;
    expect(parseActivityRows([incomplete])).toBeNull();
  });

  it("refuses one bad row in a good list", () => {
    expect(parseActivityRows([raw(), raw({ kind: "pair_drawn" })])).toBeNull();
  });

  it("refuses wrong types and values", () => {
    expect(parseActivityRows([raw({ id: "not-a-uuid" })])).toBeNull();
    expect(parseActivityRows([raw({ kind: "pair_drawn" })])).toBeNull();
    expect(parseActivityRows([raw({ exchange_id: 7 })])).toBeNull();
    expect(parseActivityRows([raw({ exchange_name: " " })])).toBeNull();
    expect(parseActivityRows([raw({ exchange_tint: "red" })])).toBeNull();
    expect(parseActivityRows([raw({ subject_name: null })])).toBeNull();
    expect(parseActivityRows([raw({ created_at: "yesterday" })])).toBeNull();
    expect(parseActivityRows([raw({ is_unread: "true" })])).toBeNull();
    expect(parseActivityRows([null])).toBeNull();
    expect(parseActivityRows([[]])).toBeNull();
  });
});

describe("parseUnreadCount", () => {
  it("accepts zero and whole numbers", () => {
    expect(parseUnreadCount(0)).toBe(0);
    expect(parseUnreadCount(12)).toBe(12);
  });

  it("refuses everything else", () => {
    expect(parseUnreadCount(-1)).toBeNull();
    expect(parseUnreadCount(1.5)).toBeNull();
    expect(parseUnreadCount("3")).toBeNull();
    expect(parseUnreadCount(null)).toBeNull();
  });
});

describe("dayLabel (AC-22, AC-36)", () => {
  // 10:00 on Sun 15 Nov in Lagos (UTC+1).
  const now = new Date("2026-11-15T09:00:00Z");

  it("says Today, Yesterday, then the day", () => {
    expect(dayLabel(new Date("2026-11-15T07:12:00Z"), now, "Africa/Lagos")).toBe("Today");
    expect(dayLabel(new Date("2026-11-14T17:40:00Z"), now, "Africa/Lagos")).toBe("Yesterday");
    expect(dayLabel(new Date("2026-10-29T15:30:00Z"), now, "Africa/Lagos")).toBe("Thu 29 Oct");
  });

  it("turns over at midnight in the viewer's zone, not UTC", () => {
    // 23:30 Lagos on the 14th is 22:30 UTC.
    expect(dayLabel(new Date("2026-11-14T22:30:00Z"), now, "Africa/Lagos")).toBe("Yesterday");
    // One minute either side of local midnight (23:00 UTC on the 14th is 00:00 on the 15th in Lagos).
    expect(dayLabel(new Date("2026-11-14T22:59:00Z"), now, "Africa/Lagos")).toBe("Yesterday");
    expect(dayLabel(new Date("2026-11-14T23:00:00Z"), now, "Africa/Lagos")).toBe("Today");
  });

  it("gives the same instant a different day in a different zone", () => {
    // 22:30 UTC on the 14th is 11:30 am on the 15th in Auckland; "now" is 10:00 pm on the 15th there.
    expect(dayLabel(new Date("2026-11-14T22:30:00Z"), now, "Pacific/Auckland")).toBe("Today");
    expect(dayLabel(new Date("2026-11-14T22:30:00Z"), now, "Africa/Lagos")).toBe("Yesterday");
    // New York is behind: 9:00 UTC on the 15th is 4:00 am there, so 3:00 am UTC is still the 14th.
    expect(dayLabel(new Date("2026-11-15T03:00:00Z"), now, "America/New_York")).toBe("Yesterday");
  });

  it("holds across a clock change (a 25-hour day in New York)", () => {
    // US clocks fall back on 1 Nov 2026. Yesterday is still the previous calendar day.
    const afterChange = new Date("2026-11-02T15:00:00Z");
    expect(dayLabel(new Date("2026-11-01T14:00:00Z"), afterChange, "America/New_York")).toBe("Yesterday");
    expect(dayLabel(new Date("2026-10-31T14:00:00Z"), afterChange, "America/New_York")).toBe("Sat 31 Oct");
  });
});

describe("toActivityItem (GC-006 S09)", () => {
  const now = new Date("2026-11-15T09:00:00Z");

  it("words a join with the first name and the time", () => {
    const item = toActivityItem(row(), now, "Africa/Lagos");
    expect(item.title).toBe("Tolu joined Family Christmas 2026.");
    expect(item.sub).toBe("6:40 pm");
    expect(item.dayLabel).toBe("Yesterday");
    expect(item.dayKey).toBe("2026-11-14");
  });

  it("words a request with Approve or decline", () => {
    const item = toActivityItem(
      row({ kind: "join_requested", subjectName: "Chidi Okeke", createdAt: "2026-11-15T07:12:00+00:00", isUnread: true }),
      now,
      "Africa/Lagos",
    );
    expect(item.title).toBe("Chidi asked to join Family Christmas 2026.");
    expect(item.sub).toBe("8:12 am · Approve or decline");
    expect(item.isUnread).toBe(true);
    expect(item.dayLabel).toBe("Today");
  });

  it("words Names drawn with no name and links to Reveal (GC-007)", () => {
    const item = toActivityItem(row({ kind: "names_drawn", subjectName: "" }), now, "Africa/Lagos");
    expect(item.title).toBe("Names are drawn for Family Christmas 2026.");
    expect(item.sub).toBe("6:40 pm · See who you're buying for");
    expect(item.href).toBe(`/exchanges/${EX}/reveal`);
  });

  it("words the join-by reminder, the event reminder and the completion with no name (pending copy)", () => {
    const reminder = toActivityItem(row({ kind: "join_by_reminder", subjectName: "" }), now, "Africa/Lagos");
    expect(reminder.title).toBe("Joining closes soon for Family Christmas 2026.");
    expect(reminder.sub).toBe("6:40 pm · Add your wishlist");
    const event = toActivityItem(row({ kind: "event_reminder", subjectName: "" }), now, "Africa/Lagos");
    expect(event.title).toBe("Family Christmas 2026 is tomorrow.");
    expect(event.sub).toBe("6:40 pm · Get your gift ready");
    const done = toActivityItem(row({ kind: "exchange_completed", subjectName: "" }), now, "Africa/Lagos");
    expect(done.title).toBe("Family Christmas 2026 is complete.");
    expect(done.sub).toBe("6:40 pm");
    for (const item of [reminder, event, done]) expect(item.href).toBe(`/exchanges/${EX}`);
  });

  it("sends the people events to the exchange page", () => {
    expect(toActivityItem(row(), now, "Africa/Lagos").href).toBe(`/exchanges/${EX}`);
  });

  it("shows the time in the viewer's zone", () => {
    expect(toActivityItem(row(), now, "Pacific/Auckland").sub).toBe("6:40 am");
  });

  it("carries no field a pair could ride on", () => {
    expect(Object.keys(toActivityItem(row(), now, "Africa/Lagos")).sort()).toEqual(
      ["dayKey", "dayLabel", "exchangeId", "exchangeName", "exchangeTint", "href", "id", "isUnread", "sub", "title"],
    );
  });
});

describe("groupByDay", () => {
  const now = new Date("2026-11-15T09:00:00Z");
  const items = [
    toActivityItem(row({ id: "a", createdAt: "2026-11-15T07:12:00+00:00" }), now, "Africa/Lagos"),
    toActivityItem(row({ id: "b", createdAt: "2026-11-15T06:00:00+00:00" }), now, "Africa/Lagos"),
    toActivityItem(row({ id: "c", createdAt: "2026-11-14T17:40:00+00:00" }), now, "Africa/Lagos"),
    toActivityItem(row({ id: "d", createdAt: "2026-10-29T10:02:00+00:00" }), now, "Africa/Lagos"),
  ];

  it("groups consecutive rows by day, keeping the order", () => {
    const days = groupByDay(items);
    expect(days.map((d) => d.label)).toEqual(["Today", "Yesterday", "Thu 29 Oct"]);
    expect(days.map((d) => d.items.map((i) => i.id))).toEqual([["a", "b"], ["c"], ["d"]]);
  });

  it("returns no groups for no rows", () => {
    expect(groupByDay([])).toEqual([]);
  });

  it("joins a later page onto the day the earlier page ended on", () => {
    const more = toActivityItem(row({ id: "e", createdAt: "2026-10-29T08:00:00+00:00" }), now, "Africa/Lagos");
    const days = groupByDay([...items, more]);
    expect(days[2]?.items.map((i) => i.id)).toEqual(["d", "e"]);
  });
});
