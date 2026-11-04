import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countLabel } from "../../components/ui/count-label.ts";
import { initials } from "../../components/ui/initials.ts";
import { createPausableTimer } from "../../components/ui/pausable-timer.ts";
import { initialNetworkState, isOffline, networkReducer } from "../../components/layout/network-status.ts";
import { DEFAULT_TIME_ZONE, getViewerTimeZone, isValidTimeZone } from "../../lib/dates/timezone.ts";
import { isActivePath, navAccessibleName } from "../../components/layout/nav-items.ts";

describe("countLabel", () => {
  it("is hidden at 0 and below", () => {
    expect(countLabel(0)).toBeNull();
    expect(countLabel(-3)).toBeNull();
    expect(countLabel(Number.NaN)).toBeNull();
  });
  it("shows the number up to 9 and 9+ above", () => {
    expect(countLabel(1)).toBe("1");
    expect(countLabel(9)).toBe("9");
    expect(countLabel(10)).toBe("9+");
    expect(countLabel(250)).toBe("9+");
  });
});

describe("initials", () => {
  it("takes the first and last word", () => {
    expect(initials("Ada Okafor")).toBe("AO");
    expect(initials("  ngozi   chidinma  eze ")).toBe("NE");
  });
  it("uses one letter for one word and a mark for nothing", () => {
    expect(initials("Tunde")).toBe("T");
    expect(initials("   ")).toBe("?");
  });
  it("keeps accents and emoji whole", () => {
    expect(initials("Émile Zola")).toBe("ÉZ");
    expect(initials("👩🏽‍🎄 Ada")).toBe("👩🏽‍🎄A");
  });
});

describe("getViewerTimeZone", () => {
  it("accepts real zones", () => {
    expect(getViewerTimeZone("Europe/London")).toBe("Europe/London");
    expect(getViewerTimeZone("Africa/Lagos")).toBe("Africa/Lagos");
  });
  it("falls back to Lagos when missing or invalid", () => {
    expect(getViewerTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(getViewerTimeZone("")).toBe(DEFAULT_TIME_ZONE);
    expect(getViewerTimeZone("Not/AZone")).toBe(DEFAULT_TIME_ZONE);
    expect(getViewerTimeZone("<script>")).toBe(DEFAULT_TIME_ZONE);
    expect(getViewerTimeZone("x".repeat(500))).toBe(DEFAULT_TIME_ZONE);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("createPausableTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires after the delay", () => {
    const cb = vi.fn();
    createPausableTimer(cb, 4000);
    vi.advanceTimersByTime(3999);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it("keeps the remaining time across pause and resume", () => {
    const cb = vi.fn();
    const t = createPausableTimer(cb, 4000);
    vi.advanceTimersByTime(1500);
    t.pause();
    expect(t.remaining()).toBe(2500);
    vi.advanceTimersByTime(60_000);
    expect(cb).not.toHaveBeenCalled();
    t.resume();
    vi.advanceTimersByTime(2499);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it("does not fire after cancel", () => {
    const cb = vi.fn();
    const t = createPausableTimer(cb, 1000);
    t.cancel();
    vi.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("networkReducer", () => {
  it("starts online", () => {
    expect(isOffline(initialNetworkState)).toBe(false);
  });
  it("goes offline when the browser does, and clears when it returns", () => {
    const off = networkReducer(initialNetworkState, { type: "browser-offline" });
    expect(isOffline(off)).toBe(true);
    expect(isOffline(networkReducer(off, { type: "browser-online" }))).toBe(false);
  });
  it("goes offline on a request failure and clears on the next success", () => {
    const failed = networkReducer(initialNetworkState, { type: "network-error" });
    expect(isOffline(failed)).toBe(true);
    expect(isOffline(networkReducer(failed, { type: "network-success" }))).toBe(false);
  });
  it("a success does not clear a browser that is still offline", () => {
    let s = networkReducer(initialNetworkState, { type: "browser-offline" });
    s = networkReducer(s, { type: "network-success" });
    expect(isOffline(s)).toBe(true);
  });
});

describe("nav helpers", () => {
  it("matches the section and its children only", () => {
    expect(isActivePath("/exchanges", "/exchanges")).toBe(true);
    expect(isActivePath("/exchanges/abc", "/exchanges")).toBe(true);
    expect(isActivePath("/exchangesX", "/exchanges")).toBe(false);
    expect(isActivePath("/home", "/exchanges")).toBe(false);
  });
  it("names the unread count for screen readers", () => {
    expect(navAccessibleName("Activity", 3)).toBe("Activity, 3 unread");
    expect(navAccessibleName("Activity", 0)).toBeUndefined();
  });
});
