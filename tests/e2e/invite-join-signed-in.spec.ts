import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  exchangesDbStatus,
  mintCode,
  signInThroughVerify,
  uniqueEmail,
} from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";
import { VIEWPORTS } from "./viewports";
import { formatDay, formatDayTime, formatYmdDay, wallClockIn } from "../../lib/dates/format";

// Slice 5, signed in (GC-002, GC-003, GC-004, GC-008..GC-013, GC-029, GCO-004, GCO-005): the invite
// preview, join, attach a list, You're in, the exchange page for a participant and for the organiser
// (People, Invite people, Reset link), Exchanges rows, and the secrecy probes. Needs the slice 5
// migrations applied. Runs in the single-worker "signed-in" project, all three widths in turn. The
// browser runs in Africa/Lagos so "(WAT)" and the day labels are predictable.
// WHY exchanges and memberships are seeded with the service role: the specs under test are the invite
// and join screens, not Start an exchange (slice 4's spec covers that).

const ZONE = "Africa/Lagos";
const NOT_AVAILABLE = "This exchange isn't available to you";
const CANT_USE = "This invite can't be used";
const created: string[] = [];
const toast = (page: Page) => page.locator("[popover]");

function ymdIn(days: number): string {
  return wallClockIn(new Date(Date.now() + days * 86_400_000), ZONE).ymd;
}
const JOIN_AT = `${ymdIn(10)}T17:00:00Z`; // 6:00 pm in Lagos
const GIFT = ymdIn(20);
const DRAW_DAY = formatDay(new Date(JOIN_AT), ZONE);
const JOIN_LABEL = formatYmdDay(ymdIn(10)) ?? "";

type Person = { id: string; email: string; first: string };

async function newPerson(first: string, options: { confirmed?: boolean; onboarded?: boolean } = {}): Promise<Person> {
  const email = uniqueEmail(first.toLowerCase());
  const { confirmed = true, onboarded = confirmed } = options;
  const id = await createTestUser(email, first, confirmed, onboarded);
  created.push(email);
  return { id, email, first };
}

type Seeded = { id: string; token: string; name: string };

async function seedExchange(
  organiser: Person,
  name: string,
  options: { takingPart?: boolean; manual?: boolean; note?: string } = {},
): Promise<Seeded> {
  const { takingPart = true, manual = false, note = "Gifts after the carol service." } = options;
  const db = adminClient();
  const { data, error } = await db
    .from("exchanges")
    .insert({
      organiser_id: organiser.id,
      name,
      note,
      budget_preset: "5k_10k",
      join_by_at: JOIN_AT,
      draw_mode: manual ? "organiser_chooses" : "at_join_by",
      draw_at: manual ? null : JOIN_AT,
      gift_day: GIFT,
      organiser_tz: ZONE,
      tint: "mint",
    })
    .select("id, invite_token")
    .single();
  if (error || !data) throw new Error(`seedExchange failed: ${error?.message}`);
  const member = await db.from("exchange_members").insert({ exchange_id: data.id, user_id: organiser.id, taking_part: takingPart });
  if (member.error) throw new Error(`seedExchange member failed: ${member.error.message}`);
  return { id: data.id, token: data.invite_token, name };
}

async function addMember(exchangeId: string, person: Person, state: "active" | "left" | "removed" = "active") {
  const { error } = await adminClient()
    .from("exchange_members")
    .insert({
      exchange_id: exchangeId,
      user_id: person.id,
      taking_part: true,
      state,
      left_at: state === "active" ? null : new Date().toISOString(),
    });
  if (error) throw new Error(`addMember failed: ${error.message}`);
}

async function seedWishlist(owner: Person, name: string, items: string[]): Promise<string> {
  const db = adminClient();
  const { data, error } = await db.from("wishlists").insert({ owner_id: owner.id, name, visibility: "private" }).select("id").single();
  if (error || !data) throw new Error(`seedWishlist failed: ${error?.message}`);
  const rows = items.map((n) => ({ wishlist_id: data.id, name: n, priority: "nice_to_have" as const }));
  const inserted = await db.from("wishlist_items").insert(rows);
  if (inserted.error) throw new Error(`seedWishlist items failed: ${inserted.error.message}`);
  return data.id;
}

async function signIn(context: BrowserContext, page: Page, person: Person, next: string) {
  await signInThroughVerify(context, page, person.email, { next });
}

async function memberRow(exchangeId: string, userId: string) {
  const { data } = await adminClient()
    .from("exchange_members")
    .select("state, taking_part, attached_wishlist_id")
    .eq("exchange_id", exchangeId)
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  return data ?? [];
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport, timezoneId: ZONE });

    test.describe("Invite and join (needs the slice 5 migrations)", () => {
      test.beforeAll(async () => {
        const status = await exchangesDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        const probe = await adminClient().rpc("get_invite_preview", { p_token: "0".repeat(32) });
        test.skip(Boolean(probe.error), "The invite_and_join migration is not applied to the Supabase project the app points at.");
      });

      test.afterEach(async () => {
        for (const email of created.splice(0)) await deleteTestUser(email);
      });

      test("organiser-draws preview says names are drawn when the organiser is ready (GC-002)", async ({ browser }) => {
        test.setTimeout(60_000);
        const organiser = await newPerson("Ngozi");
        const exchange = await seedExchange(organiser, "Office Secret Santa", { manual: true });
        const visitor = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await visitor.newPage();
          await page.goto(`/i/${exchange.token}`);
          await expect(page.getByRole("heading", { level: 1, name: "Office Secret Santa" })).toBeVisible();
          await expect(page.getByText("When Ngozi is ready")).toBeVisible();
          await expectNoAxeViolations(page);
        } finally {
          await visitor.close();
        }
      });

      test("signed-out visitor: preview without other names, a bad token, Join goes to Sign up, /join goes to Log in", async ({ browser }) => {
        test.setTimeout(120_000);
        const organiser = await newPerson("Ngozi");
        const femi = await newPerson("Femi");
        const exchange = await seedExchange(organiser, "Family Christmas 2026");
        await addMember(exchange.id, femi);

        const visitor = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await visitor.newPage();
          await page.goto(`/i/${exchange.token}`);
          await expect(page.getByRole("heading", { level: 1, name: "Family Christmas 2026" })).toBeVisible();
          await expect(page.getByText("Ngozi invited you")).toBeVisible();
          await expect(page.getByText("1 person has joined so far.")).toBeVisible();
          await expect(page.getByText("Everyone adds a wishlist.")).toHaveCount(0);
          await expect(page.getByText("Join and add a wishlist so your giver has ideas.")).toBeVisible();
          await expect(page.getByText("₦5,000 to ₦10,000")).toBeVisible();
          await expect(page.getByText(formatDayTime(new Date(JOIN_AT), ZONE)).first()).toBeVisible();
          await expect(page.getByText("Times are in your time zone (WAT).")).toBeVisible();
          await expectNoAxeViolations(page);
          await page.screenshot({ path: `test-results/screenshots/invite-preview-${width}.png`, fullPage: true });

          // AC-1: no other person's name, no note, in the HTML the visitor gets.
          const html = await (await visitor.request.get(`/i/${exchange.token}`)).text();
          expect(html).not.toContain("Femi");
          expect(html).not.toContain("carol service");
          expect(html).not.toContain(femi.email);

          await page.getByRole("link", { name: "Join this exchange" }).click();
          await expect(page).toHaveURL(new RegExp(`/signup\\?next=${encodeURIComponent(`/i/${exchange.token}/join`)}$`));
          await expect(page.getByText("You're joining Family Christmas 2026")).toBeVisible();
          await expectNoAxeViolations(page);

          // A bad token and a malformed one show the same state, with status 200.
          for (const bad of ["0".repeat(32), "not-a-token"]) {
            const response = await page.goto(`/i/${bad}`);
            expect(response?.status()).toBe(200);
            await expect(page.getByRole("heading", { name: CANT_USE })).toBeVisible();
          }
          await expect(page.getByRole("link", { name: "Go to Unwrap" })).toBeVisible();
          await expectNoAxeViolations(page);
          await page.screenshot({ path: `test-results/screenshots/invite-unavailable-${width}.png`, fullPage: true });

          // /join signed out goes to Log in with the way back.
          await page.goto(`/i/${exchange.token}/join`);
          await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(`/i/${exchange.token}/join`)}$`));
          await expect(page.getByText("You're joining Family Christmas 2026")).toBeVisible();
        } finally {
          await visitor.close();
        }
      });

      test("new joiner: Sign up with the banner, Verify, no Profile setup, Join, add ideas, You're in, the exchange page", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await newPerson("Ngozi");
        const exchange = await seedExchange(organiser, "Church choir swap");
        // An abandoned sign-up stands for a person who has just typed their name and email.
        const joiner = await newPerson("Chidi", { confirmed: false });

        const context = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await context.newPage();
          await page.route("**/auth/v1/otp**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
          await page.goto(`/i/${exchange.token}`);
          await page.getByRole("link", { name: "Join this exchange" }).click();
          await page.waitForLoadState("networkidle");
          await expect(page.getByText("You're joining Church choir swap")).toBeVisible();
          await page.getByLabel("First name").fill("Chidi");
          await page.getByLabel("Email").fill(joiner.email);
          await page.getByRole("button", { name: "Continue" }).click();
          await expect(page).toHaveURL(/\/verify$/);
          await expect(page.getByText("You're joining Church choir swap")).toBeVisible();
          await page.waitForLoadState("networkidle");
          await page.getByLabel("6-digit code").fill(await mintCode(joiner.email));

          // GC-003 / owner Q1: straight to the join confirmation, not Profile setup.
          await expect(page).toHaveURL(new RegExp(`/i/${exchange.token}/join$`), { timeout: 30_000 });
          await expect(page.getByRole("heading", { name: "What you're agreeing to" })).toBeVisible();
          await expect(page.getByText("Organised by Ngozi")).toBeVisible();
          await expect(page.getByText(`${DRAW_DAY}`).first()).toBeVisible();
          await expectNoAxeViolations(page);
          await page.screenshot({ path: `test-results/screenshots/join-confirm-${width}.png`, fullPage: true });
          // Nothing is created before Join exchange.
          expect(await memberRow(exchange.id, joiner.id)).toEqual([]);

          await page.getByRole("button", { name: "Join exchange" }).click();
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}/list\\?from=join$`), { timeout: 30_000 });
          expect(await memberRow(exchange.id, joiner.id)).toEqual([{ state: "active", taking_part: true, attached_wishlist_id: null }]);
          // The sign-up name was kept and onboarding is done (Q1).
          const profile = await adminClient().from("profiles").select("display_name, onboarded_at").eq("id", joiner.id).single();
          expect(profile.data?.display_name).toBe("Chidi");
          expect(profile.data?.onboarded_at).not.toBeNull();

          // S11 with no wishlists: ideas are the way, Skip is offered from Join.
          await page.waitForLoadState("networkidle");
          await expect(page.getByRole("heading", { level: 1, name: "Tell your giver what you'd like" })).toBeVisible();
          await expect(page.getByText("You don't have any wishlists yet, so add a few items instead.")).toBeVisible();
          await expect(page.getByRole("button", { name: "Choose a wishlist" })).toBeDisabled();
          await expect(page.getByRole("button", { name: "Skip for now" }).or(page.getByRole("link", { name: "Skip for now" }))).toBeVisible();
          await expectNoAxeViolations(page);
          await page.screenshot({ path: `test-results/screenshots/attach-nolists-${width}.png`, fullPage: true });

          await page.getByRole("button", { name: "Add items instead" }).click();
          const sheet = page.getByRole("dialog", { name: "Add an item" });
          await expect(sheet).toBeVisible();
          await expect(sheet.getByText("Only the person who draws your name will see it. It won't be added to your wishlists.")).toBeVisible();
          await sheet.getByLabel("What is it?").fill("Scented candle");
          await expectNoAxeViolations(page);
          await sheet.getByRole("button", { name: "Add to list" }).click();
          await expect(sheet).toBeHidden();
          await expect(toast(page)).toContainText("Added 'Scented candle'.");
          await expect(page.getByRole("heading", { name: "Your list for this exchange (1)" })).toBeVisible();
          await expect(page.getByText("Only for this exchange", { exact: true }).first()).toBeVisible();
          await expectNoAxeViolations(page);
          await page.screenshot({ path: `test-results/screenshots/attach-ideas-${width}.png`, fullPage: true });

          // The ideas list is hidden from My wishlists and has the exchange's id.
          const ideas = await adminClient().from("wishlists").select("id, kind, visibility, exchange_id").eq("owner_id", joiner.id);
          expect(ideas.data).toEqual([expect.objectContaining({ kind: "exchange_ideas", visibility: "private", exchange_id: exchange.id })]);

          // Edit, bin and Undo.
          await page.getByRole("button", { name: /^Scented candle/ }).click();
          const edit = page.getByRole("dialog", { name: "Edit item" });
          await edit.getByLabel("What is it?").fill("Scented candle, large");
          await edit.getByRole("button", { name: "Save" }).click();
          await expect(edit).toBeHidden();
          await expect(toast(page)).toContainText("Saved 'Scented candle, large'.");
          await page.getByRole("button", { name: "Remove Scented candle, large" }).click();
          await expect(toast(page)).toContainText("Removed 'Scented candle, large'.");
          await toast(page).getByRole("button", { name: "Undo" }).click();
          await expect(page.getByRole("button", { name: /^Scented candle, large/ })).toBeVisible();

          // Done goes to You're in (S12).
          await page.getByRole("button", { name: "Done" }).click();
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}/joined$`));
          await expect(page.getByRole("heading", { level: 1, name: "You're in" })).toBeVisible();
          await expect(page.getByText("There's nothing else to do until names are drawn.")).toBeVisible();
          await expect(page.getByText("Share the invite link")).toHaveCount(0);
          await expectNoAxeViolations(page);
          await page.screenshot({ path: `test-results/screenshots/youre-in-${width}.png`, fullPage: true });

          await page.getByRole("link", { name: "Go to exchange" }).click();
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}$`));

          // S14 participant view.
          await expect(page.getByRole("heading", { level: 1, name: "Church choir swap" })).toBeVisible();
          await expect(page.getByText(`Names are drawn on ${DRAW_DAY}.`)).toBeVisible();
          await expect(page.getByText("Organised by Ngozi · Everyone spends ₦5,000 to ₦10,000")).toBeVisible();
          await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
          await expect(page.getByText("Only for this exchange. 1 item. You can change it until the draw.")).toBeVisible();
          await expect(page.getByText(`You'll find out on ${DRAW_DAY}.`)).toBeVisible();
          await expect(page.getByText(`${formatDayTime(new Date(JOIN_AT), ZONE)}`).first()).toBeVisible();
          await expect(page.getByText("Times are in your time zone (WAT).")).toBeVisible();
          await expect(page.getByRole("heading", { name: "People (2)" })).toBeVisible();
          await expect(page.getByText("Ngozi (organising) and you.")).toBeVisible();
          await expect(page.getByRole("heading", { name: "From Ngozi" })).toBeVisible();
          await expect(page.getByText("Gifts after the carol service.")).toBeVisible();
          // AC-24: no link, no organiser tools, no Leave, no Not available.
          for (const hidden of ["Share the invite link", "Organiser tools", "Invite people", "Leave exchange", NOT_AVAILABLE]) {
            await expect(page.getByText(hidden)).toHaveCount(0);
          }
          await expectNoAxeViolations(page);
          await page.screenshot({ path: `test-results/screenshots/exchange-member-${width}.png`, fullPage: true });

          // Exchanges: "You joined today."
          await page.goto("/exchanges");
          await expect(page.getByText(`You joined today. Names are drawn ${DRAW_DAY}.`)).toBeVisible();
          await expectNoAxeViolations(page);
          await page.screenshot({ path: `test-results/screenshots/exchanges-joined-${width}.png`, fullPage: true });

          // A member who opens the link again goes straight to the exchange (AC-4).
          await page.goto(`/i/${exchange.token}`);
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}$`));
          await page.goto(`/i/${exchange.token}/join`);
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}$`));
          expect(await memberRow(exchange.id, joiner.id)).toHaveLength(1);
        } finally {
          await context.close();
        }
      });

      test("existing account: Log in with the banner, join, Skip for now, then attach a wishlist from the exchange page", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await newPerson("Ngozi");
        const exchange = await seedExchange(organiser, "Book club gift swap", { manual: true });
        const joiner = await newPerson("Bisi");
        await seedWishlist(joiner, "My Christmas wishlist", ["Ankara tote bag", "Novel"]);
        await seedWishlist(joiner, "Birthday list", ["Mug"]);

        const context = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await context.newPage();
          await page.route("**/auth/v1/otp**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
          await page.goto(`/i/${exchange.token}`);
          await page.getByRole("link", { name: "I already have an account" }).click();
          await page.waitForLoadState("networkidle");
          await expect(page.getByText("You're joining Book club gift swap")).toBeVisible();
          await page.getByLabel("Email").fill(joiner.email);
          await page.getByRole("button", { name: "Send code" }).click();
          await expect(page).toHaveURL(/\/verify$/);
          await page.waitForLoadState("networkidle");
          await page.getByLabel("6-digit code").fill(await mintCode(joiner.email));
          await expect(page).toHaveURL(new RegExp(`/i/${exchange.token}/join$`), { timeout: 30_000 });
          // The organiser-draws variant (owner Q13: pending copy).
          await expect(page.getByText("When Ngozi is ready").first()).toBeVisible();
          await page.getByRole("button", { name: "Join exchange" }).click();
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}/list\\?from=join$`), { timeout: 30_000 });
          await page.waitForLoadState("networkidle");

          // The picker: radios for wishlists only (the ideas list never appears).
          await page.getByRole("button", { name: "Choose a wishlist" }).click();
          const picker = page.getByRole("dialog", { name: "Choose a wishlist" });
          await expect(picker.getByRole("radio")).toHaveCount(2);
          await expectNoAxeViolations(page);
          await page.screenshot({ path: `test-results/screenshots/attach-picker-${width}.png`, fullPage: true });
          await picker.getByRole("button", { name: "Cancel" }).click();
          await expect(picker).toBeHidden();

          // Skip for now goes to You're in with the missing-list state.
          await page.getByText("Skip for now", { exact: true }).click();
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}/joined$`));
          await expect(page.getByRole("heading", { level: 1, name: "You're in" })).toBeVisible();
          await expect(page.getByText("No list yet")).toBeVisible();
          await expectNoAxeViolations(page);
          expect((await memberRow(exchange.id, joiner.id))[0]?.attached_wishlist_id).toBeNull();

          // From the exchange page: the no-list row, then attach. No Skip here, Back instead.
          await page.getByRole("link", { name: "Go to exchange" }).click();
          await expect(page.getByText("Nothing yet. Your giver has nothing to go on.")).toBeVisible();
          await expect(page.getByRole("heading", { name: "You're all set" })).toHaveCount(0);
          await expect(page.getByText("Names are drawn when Ngozi is ready.")).toBeVisible();
          await page.getByRole("link", { name: "Your list for this exchange" }).click();
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}/list$`));
          await expect(page.getByText("Skip for now")).toHaveCount(0);
          await page.waitForLoadState("networkidle");
          await page.getByRole("button", { name: "Choose a wishlist" }).click();
          await picker.getByText("My Christmas wishlist", { exact: true }).click();
          await picker.getByRole("button", { name: "Use this wishlist" }).click();
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}$`), { timeout: 30_000 });
          await expect(toast(page)).toContainText("Wishlist attached. Your giver will see it after the draw.");
          await expect(page.getByText("From 'My Christmas wishlist'. 2 items. You can change it until the draw.")).toBeVisible();
          await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
          expect((await memberRow(exchange.id, joiner.id))[0]?.attached_wishlist_id).not.toBeNull();

          await page.goto("/exchanges");
          await expect(page.getByText("You joined today. Names are drawn when the organiser is ready.")).toBeVisible();
        } finally {
          await context.close();
        }
      });

      test("organiser: People, Invite people sheet, copy, Reset link (the old link stops working), Exchanges row", async ({ browser, context, page }) => {
        test.setTimeout(240_000);
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "ok" }));
        const organiser = await newPerson("Ngozi");
        const femi = await newPerson("Femi");
        const bisi = await newPerson("Bisi");
        const exchange = await seedExchange(organiser, "Family Christmas 2026");
        await signIn(context, page, organiser, `/exchanges/${exchange.id}`);
        await page.waitForLoadState("networkidle");

        // Alone: the board's line, no faces.
        await expect(page.getByText("Only you so far. People show here as they join.")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Organiser tools" })).toBeVisible();

        await addMember(exchange.id, femi);
        await addMember(exchange.id, bisi);
        await page.reload();
        await expect(page.getByText("3 people in.", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "People (3)" })).toBeVisible();
        await expect(page.getByText("You (organising), Femi and Bisi.")).toBeVisible();
        await expect(page.getByText("Nothing yet. Add one so your giver has ideas.")).toBeVisible();
        for (const hidden of ["Edit details", "Draw names now…", "Cancel exchange…", "Exclusions", "Invite by email"]) {
          await expect(page.getByText(hidden)).toHaveCount(0);
        }
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchange-organiser-people-${width}.png`, fullPage: true });

        // Invite people sheet.
        const origin = new URL(page.url()).origin;
        const oldLink = `${origin}/i/${exchange.token}`;
        await page.getByRole("button", { name: /^Invite people/ }).click();
        const sheet = page.getByRole("dialog", { name: "Invite people" });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByText(`People can join until ${JOIN_LABEL}.`)).toBeVisible();
        await expect(sheet.getByText(oldLink, { exact: true })).toBeVisible();
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/invite-sheet-${width}.png`, fullPage: true });
        const popup = page.waitForEvent("popup");
        await sheet.getByRole("button", { name: "Share to WhatsApp" }).click();
        const wa = await popup;
        expect(new URL(wa.url()).searchParams.get("text")).toBe(`Join "Family Christmas 2026" on Unwrap: ${oldLink}`);
        await wa.close();
        await sheet.getByRole("button", { name: "Copy link" }).click();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(oldLink);

        // Reset link: confirm, Keep link first, then Reset.
        await sheet.getByRole("button", { name: "Reset link…" }).click();
        const confirm = page.getByRole("alertdialog", { name: "Reset the invite link?" });
        await expect(confirm).toBeVisible();
        await expect(
          confirm.getByText(
            "The old link stops working straight away. Anyone who hasn't joined yet needs the new one. People already in aren't affected.",
          ),
        ).toBeVisible();
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/invite-reset-${width}.png`, fullPage: true });
        await confirm.getByRole("button", { name: "Keep link" }).click();
        await expect(sheet).toBeVisible();
        await sheet.getByRole("button", { name: "Reset link…" }).click();
        await confirm.getByRole("button", { name: "Reset link" }).click();
        await expect(sheet).toBeVisible();
        await expect(toast(page)).toBeHidden(); // held while a sheet is open
        await sheet.getByRole("button", { name: "Done" }).click();
        await expect(toast(page)).toContainText("Link reset. The old link no longer works.");

        const fresh = await adminClient().from("exchanges").select("invite_token").eq("id", exchange.id).single();
        const newToken = fresh.data?.invite_token ?? "";
        expect(newToken).not.toBe(exchange.token);
        expect(newToken).toMatch(/^[0-9a-f]{32}$/);
        // The new link replaces the old on screen, in the page section and in the sheet.
        await expect(page.getByText(`${origin}/i/${newToken}`, { exact: true }).first()).toBeVisible();
        await expect(page.getByText(oldLink, { exact: true })).toHaveCount(0);
        await page.screenshot({ path: `test-results/screenshots/invite-resetdone-${width}.png`, fullPage: true });

        // The old link now shows the unavailable state; the new one works. Members are unaffected.
        const visitor = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const visitorPage = await visitor.newPage();
          await visitorPage.goto(`/i/${exchange.token}`);
          await expect(visitorPage.getByRole("heading", { name: CANT_USE })).toBeVisible();
          await visitorPage.goto(`/i/${newToken}`);
          await expect(visitorPage.getByRole("heading", { level: 1, name: "Family Christmas 2026" })).toBeVisible();
          await expect(visitorPage.getByText("2 people have joined so far.")).toBeVisible();
        } finally {
          await visitor.close();
        }
        expect((await memberRow(exchange.id, femi.id))[0]?.state).toBe("active");

        // Exchanges: the organiser's row with people in it (the board's wording).
        await page.goto("/exchanges");
        await expect(page.getByText(`You created this. 3 people in. Names are drawn ${DRAW_DAY}.`)).toBeVisible();
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/exchanges-organiser-${width}.png`, fullPage: true });
      });

      test("organiser S49: attach a wishlist, switch to ideas and back; just organising has no row", async ({ context, page }) => {
        test.setTimeout(240_000);
        const organiser = await newPerson("Ngozi");
        const exchange = await seedExchange(organiser, "Family Christmas 2026");
        const justOrganising = await seedExchange(organiser, "Book club gift swap", { takingPart: true });
        // Turn the second exchange into a just-organising one.
        await adminClient().from("exchange_members").update({ taking_part: false }).eq("exchange_id", justOrganising.id);
        await seedWishlist(organiser, "My Christmas wishlist", ["Ankara tote bag", "Novel"]);
        // Ideas the organiser made earlier: one item, not attached.
        const ideas = await adminClient()
          .from("wishlists")
          .insert({ owner_id: organiser.id, name: "Exchange ideas", kind: "exchange_ideas", exchange_id: exchange.id, visibility: "private" })
          .select("id")
          .single();
        await adminClient().from("wishlist_items").insert({ wishlist_id: ideas.data?.id, name: "Scented candle", priority: "nice_to_have" });

        await signIn(context, page, organiser, `/exchanges/${exchange.id}`);
        await page.waitForLoadState("networkidle");
        await expect(page.getByText("Nothing yet. Add one so your giver has ideas.")).toBeVisible();
        await page.getByRole("link", { name: "Your list for this exchange" }).click();
        await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}/my-list$`));
        await page.waitForLoadState("networkidle");
        // No Skip on S49, Back leaves without a list.
        await expect(page.getByText("Skip for now")).toHaveCount(0);
        await expectNoAxeViolations(page);
        await page.screenshot({ path: `test-results/screenshots/my-list-${width}.png`, fullPage: true });

        await page.getByRole("button", { name: "Choose a wishlist" }).click();
        const picker = page.getByRole("dialog", { name: "Choose a wishlist" });
        await picker.getByText("My Christmas wishlist", { exact: true }).click();
        await picker.getByRole("button", { name: "Use this wishlist" }).click();
        await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}$`), { timeout: 30_000 });
        await expect(toast(page)).toContainText("Wishlist attached. Your giver will see it after the draw.");
        await expect(page.getByText("From 'My Christmas wishlist'. 2 items. You can change it until the draw.")).toBeVisible();

        // Switch to the ideas kept for this exchange, then back to the wishlist.
        await page.getByRole("link", { name: "Your list for this exchange" }).click();
        await page.waitForLoadState("networkidle");
        await expectNoAxeViolations(page);
        await page.getByRole("button", { name: "Add items instead" }).click();
        await expect(page.getByRole("heading", { name: "Your list for this exchange (1)" })).toBeVisible();
        await page.getByRole("button", { name: "Done" }).click();
        await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}$`), { timeout: 30_000 });
        await expect(page.getByText("Only for this exchange. 1 item. You can change it until the draw.")).toBeVisible();
        const afterIdeas = await memberRow(exchange.id, organiser.id);
        expect(afterIdeas[0]?.attached_wishlist_id).toBe(ideas.data?.id);

        // Just organising: no list row, and /my-list is not available.
        await page.goto(`/exchanges/${justOrganising.id}`);
        await expect(page.getByText("You're just organising.", { exact: true })).toBeVisible();
        await expect(page.getByText("Your list for this exchange")).toHaveCount(0);
        await expect(page.getByText("Who you're buying for")).toHaveCount(0);
        await page.goto(`/exchanges/${justOrganising.id}/my-list`);
        await expect(page.getByRole("heading", { level: 1, name: NOT_AVAILABLE })).toBeVisible();
      });

      test("an outsider gets Not available on all four routes, with no exchange data in the HTML", async ({ context, page }) => {
        test.setTimeout(180_000);
        const organiser = await newPerson("Ngozi");
        const outsider = await newPerson("Tolu");
        const exchange = await seedExchange(organiser, "Secret Santa 2026");
        await signIn(context, page, outsider, "/home");
        for (const route of ["", "/list", "/my-list", "/joined"]) {
          const path = `/exchanges/${exchange.id}${route}`;
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1, name: NOT_AVAILABLE })).toBeVisible();
          const html = await (await context.request.get(path)).text();
          expect(html).not.toContain("Secret Santa 2026");
          expect(html).not.toContain(exchange.token);
          expect(html).not.toContain("Ngozi");
        }
        await expectNoAxeViolations(page);
        // A taking-part member who is not the organiser also gets Not available on /my-list.
        await addMember(exchange.id, outsider);
        await page.goto(`/exchanges/${exchange.id}/my-list`);
        await expect(page.getByRole("heading", { level: 1, name: NOT_AVAILABLE })).toBeVisible();
      });

      test("secrecy: the invite token and other people's emails and list status stay out of every page payload", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await newPerson("Ngozi");
        const femi = await newPerson("Femi");
        const bisi = await newPerson("Bisi");
        const exchange = await seedExchange(organiser, "Family Christmas 2026");
        await addMember(exchange.id, femi);
        await addMember(exchange.id, bisi);
        const bisiList = await seedWishlist(bisi, "Bisi secret wishlist", ["Bisi hidden gadget"]);
        await adminClient()
          .from("exchange_members")
          .update({ attached_wishlist_id: bisiList })
          .eq("exchange_id", exchange.id)
          .eq("user_id", bisi.id);
        const femiIdeas = await adminClient()
          .from("wishlists")
          .insert({ owner_id: femi.id, name: "Exchange ideas", kind: "exchange_ideas", exchange_id: exchange.id, visibility: "private" })
          .select("id")
          .single();
        await adminClient().from("wishlist_items").insert({ wishlist_id: femiIdeas.data?.id, name: "Femi hidden idea", priority: "nice_to_have" });

        async function payloads(person: Person, routes: string[]) {
          const context = await browser.newContext({ viewport, timezoneId: ZONE });
          try {
            const page = await context.newPage();
            await signIn(context, page, person, "/home");
            const out: string[] = [];
            for (const route of routes) out.push(await (await context.request.get(route)).text());
            await page.goto("/exchanges");
            out.push(await page.content());
            return out;
          } finally {
            await context.close();
          }
        }

        const base = `/exchanges/${exchange.id}`;
        const secrets = [bisi.email, femi.email, "Bisi secret wishlist", "Bisi hidden gadget", "Femi hidden idea", bisiList];

        // The organiser's own pages carry the token, and nothing of anyone else's list or email.
        const organiserPages = await payloads(organiser, [base, `${base}/my-list`]);
        expect(organiserPages[0]).toContain(exchange.token);
        for (const html of organiserPages) {
          for (const secret of secrets) expect(html).not.toContain(secret);
        }

        // A co-member sees names, never the token, emails or anyone else's list status.
        for (const [person, other] of [[femi, bisi], [bisi, femi]] as const) {
          const pages = await payloads(person, [base, `${base}/list`, `${base}/joined`]);
          for (const html of pages) {
            expect(html).not.toContain(exchange.token);
            expect(html).not.toContain(other.email);
            expect(html).not.toContain(organiser.email);
          }
          expect(pages[0]).toContain(other.first);
        }
        const femiPages = await payloads(femi, [base, `${base}/list`, `${base}/joined`]);
        for (const html of femiPages) {
          expect(html).not.toContain("Bisi secret wishlist");
          expect(html).not.toContain("Bisi hidden gadget");
        }
      });

      test("a former member rejoins with the link; a removed member is refused", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await newPerson("Ngozi");
        const former = await newPerson("Femi");
        const removed = await newPerson("Bisi");
        const exchange = await seedExchange(organiser, "Family Christmas 2026");
        await addMember(exchange.id, former, "left");
        await addMember(exchange.id, removed, "removed");

        const formerContext = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await formerContext.newPage();
          await signIn(formerContext, page, former, `/i/${exchange.token}/join`);
          await expect(page.getByRole("heading", { name: "What you're agreeing to" })).toBeVisible();
          await page.getByRole("button", { name: "Join exchange" }).click();
          await expect(page).toHaveURL(new RegExp(`/exchanges/${exchange.id}/list\\?from=join$`), { timeout: 30_000 });
          const rows = await memberRow(exchange.id, former.id);
          expect(rows.map((r) => r.state).sort()).toEqual(["active", "left"]);
        } finally {
          await formerContext.close();
        }

        const removedContext = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await removedContext.newPage();
          await signIn(removedContext, page, removed, `/i/${exchange.token}/join`);
          await expect(page.getByRole("heading", { name: CANT_USE })).toBeVisible();
          await expect(page.getByText("You can't join 'Family Christmas 2026' with this link.")).toBeVisible();
          await expectNoAxeViolations(page);
          const rows = await memberRow(exchange.id, removed.id);
          expect(rows.map((r) => r.state)).toEqual(["removed"]);
          await page.goto(`/exchanges/${exchange.id}`);
          await expect(page.getByRole("heading", { level: 1, name: NOT_AVAILABLE })).toBeVisible();
        } finally {
          await removedContext.close();
        }
      });
    });
  });
}
