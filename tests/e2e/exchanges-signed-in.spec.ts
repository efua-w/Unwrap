import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  exchangesDbStatus,
  signInThroughVerify,
  uniqueEmail,
} from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";
import { VIEWPORTS } from "./viewports";
import { formatYmdLongFull } from "../../lib/dates/calendar";
import { formatDay, formatTime, formatYmdDay, formatYmdDayYear, wallClockIn, zoneShortName } from "../../lib/dates/format";

// Slice 4, signed in (GCO-001..004, GC-008, GC-013, GC-029): Start an exchange in three steps, the
// just-started exchange page, Exchanges, and the "not available" state. Needs the exchanges migration
// applied (see exchangesDbStatus). Runs in the single-worker "signed-in" project, all three widths in
// turn. The browser runs in Africa/Lagos so "(WAT)" and the day labels are predictable.

const ZONE = "Africa/Lagos";
const created: string[] = [];
const toast = (page: Page) => page.locator("[popover]");

// Dates the form accepts: join-by 10 days out, gifts 20 days out, as wall-clock days in Lagos.
function ymdIn(days: number): string {
  return wallClockIn(new Date(Date.now() + days * 86_400_000), ZONE).ymd;
}
const JOIN = ymdIn(10);
const GIFT = ymdIn(20);

async function newOrganiser(context: BrowserContext, page: Page, next = "/exchanges"): Promise<string> {
  const email = uniqueEmail("exch");
  const userId = await createTestUser(email, "Amaka");
  created.push(email);
  await signInThroughVerify(context, page, email, { next });
  return userId;
}

async function openFlow(page: Page) {
  await page.goto("/exchanges/new");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Name your exchange" })).toBeVisible();
}

async function fillBasics(page: Page, name: string, note = "") {
  await page.getByLabel("Name", { exact: true }).fill(name);
  if (note) await page.getByLabel("Note for everyone (optional)").fill(note);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Budget and dates" })).toBeVisible();
}

// WHY the label text and not check(): the radio is visually hidden inside its pill, so a person taps the
// pill. (The pill is the target; the pinned footer can cover it only until the page scrolls.)
async function chooseDrawMode(page: Page, label: "When joining closes" | "When I choose") {
  await page.getByText(label, { exact: true }).click();
  await expect(page.getByRole("radio", { name: label })).toBeChecked();
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Opens the date picker, moves to the month of `ymd` with the arrow buttons, and chooses the day.
// WHY the month is read from the header: the picker opens on the value's month, else the current one.
async function pickDate(page: Page, label: "Join by" | "Gift day", ymd: string) {
  await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  const dialog = page.getByRole("dialog", { name: label });
  await expect(dialog).toBeVisible();
  const shown = ((await dialog.locator("[aria-live=polite]").textContent()) ?? "").split(" ");
  const monthIndex = (year: number, month: number) => year * 12 + month;
  const from = monthIndex(Number(shown[1]), MONTH_NAMES.indexOf(shown[0] ?? ""));
  const to = monthIndex(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1);
  const arrow = dialog.getByRole("button", { name: to > from ? "Next month" : "Previous month" });
  for (let i = 0; i < Math.abs(to - from); i += 1) await arrow.click();
  await dialog.getByRole("button", { name: formatYmdLongFull(ymd) ?? "" }).click();
  await expect(dialog).toBeHidden();
  const trigger = page.getByRole("button", { name: new RegExp(`^${label}`) });
  await expect(trigger).toHaveText(formatYmdDayYear(ymd) ?? "");
  // The name carries the chosen date, not only the label.
  await expect(trigger).toHaveAccessibleName(`${label} ${formatYmdDayYear(ymd)}`);
}

async function fillDates(page: Page, options: { mode?: "auto" | "manual" } = {}) {
  await page.getByRole("radio", { name: "₦5,000 to ₦10,000" }).check();
  await pickDate(page, "Join by", JOIN);
  await pickDate(page, "Gift day", GIFT);
  // The gift day is a date only (owner decision 2026-11-09): there is no gift time field.
  await expect(page.getByLabel("Gift time")).toHaveCount(0);
  if (options.mode === "manual") await chooseDrawMode(page, "When I choose");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rules and review" })).toBeVisible();
}

async function startExchange(page: Page) {
  await page.getByRole("button", { name: "Start exchange" }).click();
  await expect(page).toHaveURL(/\/exchanges\/[0-9a-f-]{36}$/, { timeout: 30_000 });
}

async function lastExchange(userId: string) {
  const { data } = await adminClient()
    .from("exchanges")
    .select("id, name, note, budget_preset, draw_mode, draw_at, organiser_tz, approval_required, invite_token, tint")
    .eq("organiser_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function organiserWithExchange(
  context: BrowserContext,
  page: Page,
  name: string,
  options: { mode?: "auto" | "manual"; justOrganising?: boolean } = {},
) {
  const userId = await newOrganiser(context, page);
  await openFlow(page);
  await fillBasics(page, name);
  await fillDates(page, options);
  if (options.justOrganising) await page.getByRole("radio", { name: "No, just organising" }).check();
  await startExchange(page);
  return userId;
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport, timezoneId: ZONE });

    test.describe("Start an exchange (needs the exchanges migration)", () => {
      test.beforeAll(async () => {
        const status = await exchangesDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
      });

      test.afterEach(async () => {
        for (const email of created.splice(0)) await deleteTestUser(email);
      });

      test("organiser taking part: first-time Exchanges, the three steps, the page, the list", async ({ page, context }) => {
        test.setTimeout(240_000);
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        // WHY: the WhatsApp tab must not reach the real site.
        await context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "ok" }));
        const userId = await newOrganiser(context, page);

        // S08 first time: How Unwrap works, no tabs, Start an exchange, the invite help line.
        await expect(page.getByRole("heading", { level: 1, name: "Exchanges" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "How Unwrap works" })).toBeVisible();
        await expect(page.getByText("Got an invite? Open the link you were sent and you'll land in that exchange.")).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Show exchanges" })).toHaveCount(0);
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchanges-first-${width}.png`, fullPage: true });
        await page.getByRole("link", { name: "Start an exchange" }).click();
        await expect(page).toHaveURL(/\/exchanges\/new$/);
        await page.waitForLoadState("networkidle");

        // S26 Basics: Next with no name shows the line and focuses the field.
        await expect(page.getByText("Start an exchange · Step 1 of 3")).toBeVisible();
        await expect(page.getByText("You can change any of this later.")).toBeVisible();
        await expect(page.getByText("This is what people see in the invite.")).toBeVisible();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.getByText("Add a name so people know which exchange this is.")).toBeVisible();
        await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchange-basics-error-${width}.png`, fullPage: true });
        await fillBasics(page, "Book club gift swap", "One book you loved this year, wrapped.");

        // S27 Budget and dates: empty Next flags every required field.
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.getByText("Pick a budget so everyone spends about the same.")).toBeVisible();
        // Join by and Gift day are both empty; Draw time has a default, and there is no gift time.
        await expect(page.getByText("Choose a date.")).toHaveCount(2);
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchange-dates-error-${width}.png`, fullPage: true });

        // The date picker: placeholder when empty, a dropdown from 768 and the Sheet below, keyboard, Esc.
        const joinTrigger = page.getByRole("button", { name: /^Join by/ });
        await expect(joinTrigger).toHaveText("Choose a date");
        await expect(joinTrigger).toHaveAccessibleName("Join by Choose a date");
        await expect(joinTrigger).toHaveAttribute("aria-haspopup", "dialog");
        await joinTrigger.click();
        await expect(joinTrigger).toHaveAttribute("aria-expanded", "true");
        await expect(page.getByRole("dialog", { name: "Join by" })).toBeVisible();
        // A native <dialog> only at 390 (the Sheet); the dropdown is a plain element.
        await expect(page.locator("dialog[open]")).toHaveCount(viewport.width >= 768 ? 0 : 1);
        const pickerToday = ymdIn(0);
        const todayButton = page.getByRole("button", { name: formatYmdLongFull(pickerToday) ?? "" });
        await expect(todayButton).toBeFocused();
        await expect(todayButton).toHaveAttribute("aria-current", "date");
        await page.keyboard.press("ArrowDown");
        await expect(page.getByRole("button", { name: formatYmdLongFull(ymdIn(7)) ?? "" })).toBeFocused();
        // Past days cannot be picked (owner decision 2026-11-12): Previous month is off in the current
        // month, and a past day is aria-disabled and ignores a click. (On the 1st, no past day is shown.)
        await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();
        if (!pickerToday.endsWith("-01")) {
          const past = page.getByRole("button", { name: formatYmdLongFull(ymdIn(-1)) ?? "" });
          await expect(past).toHaveAttribute("aria-disabled", "true");
          await past.click({ force: true }); // WHY force: Playwright treats aria-disabled as not clickable
          await expect(page.getByRole("dialog", { name: "Join by" })).toBeVisible();
        }
        await expect(page.getByRole("button", { name: formatYmdLongFull(pickerToday) ?? "" })).not.toHaveAttribute("aria-disabled", "true");
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: "Join by" })).toBeHidden();
        await expect(joinTrigger).toBeFocused();
        await expect(joinTrigger).toHaveText("Choose a date");

        // Join by after the gift day: the line goes under Join by, and the form keeps the values.
        await page.getByRole("radio", { name: "₦5,000 to ₦10,000" }).check();
        await pickDate(page, "Join by", ymdIn(30));
        await pickDate(page, "Gift day", GIFT);
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.getByText("Join by has to be before the gift day.")).toBeVisible();
        // Fixed: defaults are "When joining closes" at 6:00 pm, and the summary names the zone.
        await pickDate(page, "Join by", JOIN);
        await expect(page.getByRole("radio", { name: "When joining closes" })).toBeChecked();
        // Draw time is a 12-hour picker: default 6:00 with PM chosen. From 768 it is a dropdown with 24
        // options; below 768 it is a sheet. Choosing 6:00 with PM keeps the value and returns focus.
        const drawTime = page.getByRole("combobox", { name: "Draw time" });
        const drawPeriod = page.getByRole("group", { name: "AM or PM" });
        await expect(drawTime).toHaveText("6:00");
        await expect(drawPeriod.getByRole("radio", { name: "PM" })).toBeChecked();
        await drawTime.click();
        const timeList = page.getByRole("listbox", { name: "Draw time" });
        if (viewport.width >= 768) {
          await expect(page.getByRole("dialog")).toHaveCount(0);
        } else {
          await expect(page.getByRole("dialog", { name: "Draw time" })).toBeVisible();
        }
        await expect(timeList.getByRole("option")).toHaveCount(24);
        await expect(timeList.getByRole("option", { name: "6:00" })).toHaveAttribute("aria-selected", "true");
        if (viewport.width < 768) {
          // Item 67: the sheet focuses the list itself, so ArrowDown moves the active option with no Tab first.
          await expect(timeList).toBeFocused();
          const before = await timeList.getAttribute("aria-activedescendant");
          await page.keyboard.press("ArrowDown");
          await expect(timeList).not.toHaveAttribute("aria-activedescendant", before ?? "");
        }
        await timeList.getByRole("option", { name: "6:00" }).click();
        await expect(timeList).toHaveCount(0);
        await expect(drawTime).toBeFocused();
        await expect(drawTime).toHaveText("6:00");
        await expect(drawPeriod.getByRole("radio", { name: "PM" })).toBeChecked();
        // Join by and Gift day share a row from 768 and stack below it.
        const joinBox = await page.getByRole("button", { name: /^Join by/ }).boundingBox();
        const giftBox = await page.getByRole("button", { name: /^Gift day/ }).boundingBox();
        if (!joinBox || !giftBox) throw new Error("Join by and Gift day should be visible.");
        if (viewport.width >= 768) expect(giftBox.y).toBe(joinBox.y);
        else expect(giftBox.y).toBeGreaterThan(joinBox.y + joinBox.height);
        await expect(page.getByText("Joining closes at this time on the join-by day.")).toBeVisible();
        const joinLabel = formatYmdDay(JOIN) ?? "";
        const giftLabel = formatYmdDay(GIFT) ?? "";
        const summary = page.getByRole("region", { name: "Summary" });
        await expect(summary).toContainText(
          `People can join until ${joinLabel}. We draw names that evening at 6:00 pm. Gifts are exchanged on ${giftLabel}.`,
        );
        await expect(summary).toContainText("Times are in your time zone (WAT).");
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchange-dates-auto-${width}.png`, fullPage: true });

        // "When I choose" hides the draw time and rewrites the summary; back again restores it.
        await chooseDrawMode(page, "When I choose");
        await expect(page.getByLabel("Draw time")).toHaveCount(0);
        await expect(summary).toContainText(
          `People can join until the end of ${joinLabel}. You draw names when you're ready. Gifts are exchanged on ${giftLabel}.`,
        );
        await chooseDrawMode(page, "When joining closes");
        await expect(page.getByRole("combobox", { name: "Draw time" })).toHaveText("6:00");
        await page.getByRole("button", { name: "Next", exact: true }).click();

        // S28 Review: defaults preselected, the summary reads back everything, nothing written yet.
        await expect(page.getByRole("heading", { level: 1, name: "Rules and review" })).toBeVisible();
        await expect(page.getByRole("radio", { name: "Yes, I'm in" })).toBeChecked();
        await expect(page.getByRole("radio", { name: "Anyone with the link" })).toBeChecked();
        const review = page.getByRole("region", { name: "Check everything" });
        await expect(review).toContainText("Book club gift swap");
        await expect(review).toContainText("One book you loved this year, wrapped.");
        await expect(review).toContainText("₦5,000 to ₦10,000");
        await expect(review).toContainText(`${joinLabel}, 6:00 pm`);
        await expect(review).toContainText(giftLabel);
        await expect(page.getByText("Nothing is sent until you tap Start exchange.")).toBeVisible();
        expect((await adminClient().from("exchanges").select("id").eq("organiser_id", userId)).data).toEqual([]);
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchange-review-${width}.png`, fullPage: true });

        // Edit details goes back with the values kept.
        await review.getByRole("button", { name: "Edit details" }).click();
        await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Book club gift swap");
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await startExchange(page);

        // S14 just started: header, invite, what happens next, Your part, People. No hidden controls.
        const exchange = await lastExchange(userId);
        expect(exchange).toMatchObject({
          name: "Book club gift swap",
          note: "One book you loved this year, wrapped.",
          budget_preset: "5k_10k",
          draw_mode: "at_join_by",
          organiser_tz: ZONE,
          approval_required: false,
        });
        const members = await adminClient().from("exchange_members").select("user_id, taking_part, state").eq("exchange_id", exchange?.id);
        expect(members.data).toEqual([{ user_id: userId, taking_part: true, state: "active" }]);

        const today = formatDay(new Date(), ZONE);
        await expect(page.getByRole("heading", { level: 1, name: "Book club gift swap" })).toBeVisible();
        await expect(page.getByText("Only you so far.", { exact: true })).toBeVisible();
        await expect(page.getByText(`Created by you on ${today} · Everyone spends ₦5,000 to ₦10,000`)).toBeVisible();
        await expect(page.getByRole("heading", { name: "Share the invite link" })).toBeVisible();
        await expect(page.getByText(`People can join until ${joinLabel}. Names need at least 3 people to draw.`)).toBeVisible();
        const inviteUrl = `${new URL(page.url()).origin}/i/${exchange?.invite_token}`;
        // WHY the id: the Invite people sheet (closed) holds the same link, so the page section is named by its id.
        await expect(page.locator("#exchange-invite-link")).toHaveText(inviteUrl);
        expect(inviteUrl).toMatch(/\/i\/[0-9a-f]{32}$/);
        await expect(page.getByRole("heading", { name: "What happens next" })).toBeVisible();
        await expect(page.getByText(`Anyone with the link can join until ${joinLabel}.`)).toBeVisible();
        await expect(page.getByText(`${joinLabel} at 6:00 pm.`)).toBeVisible();
        await expect(page.getByText(`${giftLabel}.`, { exact: true })).toBeVisible();
        await expect(page.getByText("Times are in your time zone (WAT).")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Your part" })).toBeVisible();
        // Slice 5 (boards Exchange-Detail-ostarted): the S49 row and the placeholder, People, Organiser tools.
        await expect(page.getByText("Nothing yet. Add one so your giver has ideas.")).toBeVisible();
        await expect(page.getByText(`You'll find out on ${formatDay(new Date(`${JOIN}T17:00:00Z`), ZONE)}.`)).toBeVisible();
        await expect(page.getByText("Only you so far. People show here as they join.")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Organiser tools" })).toBeVisible();
        // Owner decision 5: nothing whose feature is not built yet.
        for (const hidden of ["Invite by email", "Add your wishlist", "Cancel exchange…", "Edit details", "Draw names now…"]) {
          await expect(page.getByText(hidden)).toHaveCount(0);
        }
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchange-started-${width}.png`, fullPage: true });

        // Share to WhatsApp and Copy link (the ShareActions shared with the wishlist Share sheet).
        const popup = page.waitForEvent("popup");
        await page.getByRole("button", { name: "Share to WhatsApp" }).click();
        const wa = await popup;
        expect(new URL(wa.url()).searchParams.get("text")).toBe(`Join "Book club gift swap" on Unwrap: ${inviteUrl}`);
        await wa.close();
        await page.getByRole("button", { name: "Copy link" }).click();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(inviteUrl);
        await expect(toast(page)).toContainText("Link copied. Paste it anywhere to share.");
        await page.screenshot({ path: `test-results/screenshots/exchange-copied-${width}.png`, fullPage: true });

        // Back goes to Exchanges, which now leads with the "Only you so far" block.
        await page.getByRole("link", { name: "Back to Exchanges" }).first().click();
        await expect(page).toHaveURL(/\/exchanges$/);
        await expect(page.getByRole("navigation", { name: "Show exchanges" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Active" })).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("heading", { name: "Share the invite link" })).toBeVisible();
        await expect(
          page.getByText(`Share the invite link so people can join by ${joinLabel}. Names are drawn at 6:00 pm that day.`),
        ).toBeVisible();
        await expect(page.getByText("You created this. Only you so far.")).toBeVisible();
        // GC-008: a primary button in the block above means Start an exchange is secondary.
        await expect(page.getByRole("link", { name: "Start an exchange" })).toHaveClass(/border-border-emphasis/);
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchanges-started-${width}.png`, fullPage: true });
        await page.getByRole("link", { name: "Share invite link" }).click();
        await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange?.id}#invite$`));

        // Past tab: empty, quiet note.
        await page.goto("/exchanges?view=past");
        await expect(page.getByRole("link", { name: "Past" })).toHaveAttribute("aria-current", "page");
        await expect(page.getByText("Nothing here yet. Finished exchanges will move here.")).toBeVisible();
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchanges-pastempty-${width}.png`, fullPage: true });

        // Open item 53: Profile's Back is "Back to Exchanges".
        await page.goto("/profile");
        await expect(page.getByRole("link", { name: "Back to Exchanges" }).first()).toHaveAttribute("href", "/exchanges");
      });

      test("organiser just organising, with an organiser-chooses draw", async ({ context, page }) => {
        test.setTimeout(180_000);
        const userId = await organiserWithExchange(context, page, "Church choir swap", { mode: "manual", justOrganising: true });
        const exchange = await lastExchange(userId);
        expect(exchange).toMatchObject({ draw_mode: "organiser_chooses", draw_at: null });
        const members = await adminClient().from("exchange_members").select("taking_part").eq("exchange_id", exchange?.id);
        expect(members.data).toEqual([{ taking_part: false }]);

        const joinLabel = formatYmdDay(JOIN) ?? "";
        await expect(page.getByText("You're just organising.", { exact: true })).toBeVisible();
        await expect(page.getByText("You're taking part.")).toHaveCount(0);
        // "When I choose": the last joining day is the join-by day itself, and names wait for the organiser.
        await expect(page.getByText(`Anyone with the link can join until ${joinLabel}.`)).toBeVisible();
        await expect(page.getByText("When you're ready.")).toBeVisible();
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchange-ojust-${width}.png`, fullPage: true });

        await page.goto("/exchanges");
        await expect(page.getByText("You're just organising. Only you so far.")).toBeVisible();
        await expect(
          page.getByText(`Share the invite link so people can join by ${joinLabel}. You draw names when you're ready.`),
        ).toBeVisible();
      });

      test("the viewer's own time zone drives every date on the page", async ({ context, page }) => {
        test.setTimeout(180_000);
        await organiserWithExchange(context, page, "Zone check");
        const draw = new Date(`${JOIN}T17:00:00Z`); // 6:00 pm in Lagos (UTC+1, no DST)
        const auckland = "Pacific/Auckland";
        // WHY a cookie: the page reads the viewer's zone from the `tz` cookie (readViewerTimeZone).
        // WHY domain and path "/": a cookie added by url would get the page's directory as its path and sit beside the app's own tz cookie.
        await context.addCookies([{ name: "tz", value: encodeURIComponent(auckland), domain: "localhost", path: "/" }]);
        await page.reload();
        await expect(page.getByText(`${formatDay(draw, auckland)} at ${formatTime(draw, auckland)}.`)).toBeVisible();
        await expect(page.getByText(`Times are in your time zone (${zoneShortName(draw, auckland)}).`)).toBeVisible();
        expect(formatDay(draw, auckland)).not.toBe(formatDay(draw, ZONE));
      });

      test("discard: Close with nothing entered leaves, with something entered asks first", async ({ context, page }) => {
        test.setTimeout(120_000);
        const userId = await newOrganiser(context, page);
        await openFlow(page);
        await page.getByRole("button", { name: "Close" }).click();
        await expect(page).toHaveURL(/\/exchanges$/);

        await openFlow(page);
        await page.getByLabel("Name", { exact: true }).fill("Book club gift swap");
        await page.getByRole("button", { name: "Close" }).click();
        const sheet = page.getByRole("alertdialog", { name: "Discard this exchange?" });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByText("You've started filling it in. If you close now, nothing is saved and nobody is invited.")).toBeVisible();
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchange-discard-${width}.png`, fullPage: true });
        await sheet.getByRole("button", { name: "Keep going" }).click();
        await expect(sheet).toBeHidden();
        await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Book club gift swap");

        await page.getByRole("button", { name: "Close" }).click();
        await page.getByRole("alertdialog", { name: "Discard this exchange?" }).getByRole("button", { name: "Discard" }).click();
        await expect(page).toHaveURL(/\/exchanges$/);
        expect((await adminClient().from("exchanges").select("id").eq("organiser_id", userId)).data).toEqual([]);
      });

      test("a failed start keeps every input and the retry works; offline disables Start", async ({ context, page }) => {
        test.setTimeout(180_000);
        const userId = await newOrganiser(context, page);
        await openFlow(page);
        await fillBasics(page, "Book club gift swap");
        await fillDates(page);

        // Offline: Start exchange is disabled and the banner says so (GC-029: no offline writes).
        await context.setOffline(true);
        await expect(page.getByText("You're offline. Pages you've opened stay on screen.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Start exchange" })).toBeDisabled();
        await page.screenshot({ path: `test-results/screenshots/exchange-review-offline-${width}.png`, fullPage: true });
        await context.setOffline(false);
        await expect(page.getByText("You're offline. Pages you've opened stay on screen.")).toBeHidden();
        await expect(page.getByRole("button", { name: "Start exchange" })).toBeEnabled();

        // WHY rewrite the real answer (as the sign-up spec does): the request still goes through and
        // the action's wire format belongs to Next; only the result is swapped, so the test controls it
        // without a hook in app code. The exchange IS created behind the failed answer: the accepted
        // duplicate-on-retry risk (owner decision 12a), cleaned up by deleteTestUser.
        let failedOnce = false;
        await page.route(
          (url) => url.pathname === "/exchanges/new",
          async (route) => {
            const request = route.request();
            if (request.method() !== "POST" || !request.headers()["next-action"] || failedOnce) return route.fallback();
            failedOnce = true;
            const response = await route.fetch();
            const body = await response.text();
            const headers = { ...response.headers() };
            delete headers["content-length"];
            await route.fulfill({
              response,
              headers,
              body: body.replace(/\{"ok":true,"id":"[0-9a-f-]{36}"\}/, '{"ok":false,"reason":"failed"}'),
            });
          },
        );
        await page.getByRole("button", { name: "Start exchange" }).click();
        await expect(
          page.getByText("We couldn't start the exchange. Everything you entered is still here, so you can try again."),
        ).toBeVisible();
        expect(failedOnce).toBe(true);
        await expect(page).toHaveURL(/\/exchanges\/new$/);
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchange-review-error-${width}.png`, fullPage: true });

        // Inputs kept: edit details still shows the name, and Start works again.
        await page.getByRole("button", { name: "Edit details" }).click();
        await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Book club gift swap");
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await startExchange(page);
        const rows = await adminClient().from("exchanges").select("id").eq("organiser_id", userId).eq("name", "Book club gift swap");
        expect((rows.data ?? []).length).toBeGreaterThanOrEqual(1);
      });

      test("an outsider and a signed-out visitor get no exchange data", async ({ browser, context, page }) => {
        test.setTimeout(240_000);
        const userId = await organiserWithExchange(context, page, "Secret Santa 2026");
        const exchange = await lastExchange(userId);
        const path = `/exchanges/${exchange?.id}`;

        // A second person who is not in the exchange.
        const other = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const otherPage = await other.newPage();
          await newOrganiser(other, otherPage, path);
          await expect(otherPage.getByRole("heading", { level: 1, name: "This exchange isn't available to you" })).toBeVisible();
          await expect(
            otherPage.getByText("It may have been cancelled, or the link you followed is old. Nothing you added has been lost."),
          ).toBeVisible();
          await expect(otherPage.getByRole("link", { name: "Back to Home" }).first()).toBeVisible();
          await expectNoAxeViolations(otherPage);
          await otherPage.screenshot({ path: `test-results/screenshots/exchange-notavailable-${width}.png`, fullPage: true });
          // Nothing about the exchange is in the HTML the outsider gets: no name, no token, no link.
          const html = await (await other.request.get(path)).text();
          expect(html).not.toContain("Secret Santa 2026");
          expect(html).not.toContain(exchange?.invite_token ?? "token-missing");
          expect(html).not.toContain("/i/");
          // A malformed id and an unknown id answer the same.
          for (const missing of ["/exchanges/not-a-uuid", "/exchanges/00000000-0000-4000-8000-000000000000"]) {
            await otherPage.goto(missing);
            await expect(otherPage.getByRole("heading", { level: 1, name: "This exchange isn't available to you" })).toBeVisible();
          }
          // Exchanges does not list it for them.
          await otherPage.goto("/exchanges");
          await expect(otherPage.getByText("Secret Santa 2026")).toHaveCount(0);
          await expect(otherPage.getByRole("heading", { name: "How Unwrap works" })).toBeVisible();
        } finally {
          await other.close();
        }

        // Signed out: straight to Log in, then back to the exchange after.
        const visitor = await browser.newContext({ viewport });
        try {
          const visitorPage = await visitor.newPage();
          await visitorPage.goto(path);
          await expect(visitorPage).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
          await visitorPage.goto("/exchanges/new");
          await expect(visitorPage).toHaveURL(/\/login\?next=%2Fexchanges%2Fnew$/);
          await visitorPage.goto("/exchanges");
          await expect(visitorPage).toHaveURL(/\/login\?next=%2Fexchanges$/);
        } finally {
          await visitor.close();
        }
      });
    });
  });
}
