import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, exchangesDbStatus, signInThroughVerify } from "./fixtures/auth";
import { expectNoAxeViolations } from "./fixtures/axe";
import {
  ZONE,
  addMember,
  addRequest,
  attachWishlist,
  closeJoining,
  memberStates,
  people,
  requestStatuses,
  seedExchange,
  type Person,
} from "./fixtures/exchange-seed";
import { VIEWPORTS } from "./viewports";
import { formatDay } from "../../lib/dates/format";

// Slice 6, signed in (GC-012, GCO-003, GCO-005, GCO-006, GCO-007, GC-008, GC-029) and organiser-emails (2026-11-16): Ask to join, the request
// blocks, Participants (Approve, Decline, Remove), the removed person's page, access and secrecy probes, and
// offline. Needs the slice 6 migrations applied. Runs in the single-worker "signed-in" project, all three
// widths in turn; the browser runs in Africa/Lagos so day labels are predictable.

const OFFLINE = "You're offline. Pages you've opened stay on screen.";
const NOT_AVAILABLE = "This exchange isn't available to you";
const CANT_USE = "This invite can't be used";
const toast = (page: Page) => page.locator("[popover]");
const seed = people();
const CLOSED_DAY = (days: number) => formatDay(new Date(Date.now() - days * 86_400_000), ZONE);

async function signedIn(browser: Browser, viewport: { width: number; height: number }, person: Person, next: string) {
  const context = await browser.newContext({ viewport, timezoneId: ZONE });
  const page = await context.newPage();
  await signInThroughVerify(context, page, person.email, { next });
  return { context, page };
}

async function shot(page: Page, name: string, width: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}-${width}.png`, fullPage: true });
}

for (const { name: width, viewport } of VIEWPORTS) {
  test.describe(width, () => {
    test.use({ viewport, timezoneId: ZONE });

    test.describe("Approval, Participants and request blocks (needs the slice 6 migrations)", () => {
      test.beforeAll(async () => {
        const status = await exchangesDbStatus();
        test.skip(!status.ready, status.ready ? "" : status.reason);
        const probe = await adminClient().rpc("get_join_requests", { p_exchange: "00000000-0000-4000-8000-000000000000" });
        test.skip(Boolean(probe.error), "The join_requests migration is not applied to the Supabase project the app points at.");
      });

      test.afterEach(async () => {
        await seed.cleanup();
      });

      test("visitor: an approval link shows the normal preview; a closed link shows S13 with Ask to join, through Sign up", async ({ browser }) => {
        test.setTimeout(120_000);
        const organiser = await seed.newPerson("Ngozi");
        const approval = await seedExchange(organiser, "Approval swap", { approval: true });
        const closed = await seedExchange(organiser, "Closed swap");
        await closeJoining(closed.id);

        const visitor = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await visitor.newPage();
          // AC-26: the preview of an approval exchange is the normal one; nothing says "approve" before sign-in.
          await page.goto(`/i/${approval.token}`);
          await expect(page.getByRole("heading", { level: 1, name: "Approval swap" })).toBeVisible();
          await expect(page.getByText("Ngozi invited you")).toBeVisible();
          await expect(page.getByRole("link", { name: "Join this exchange" })).toBeVisible();
          await expect(page.getByText("Ask to join")).toHaveCount(0);
          await expect(page.getByText("approves everyone")).toHaveCount(0);
          await expectNoAxeViolations(page);
          await shot(page, "invite-approval-preview", width);

          // GC-012 / AC-3: joining closed, a request is still allowed.
          await page.goto(`/i/${closed.token}`);
          await expect(page.getByRole("heading", { level: 1, name: CANT_USE })).toBeVisible();
          await expect(page.getByText(`Ngozi closed joining for 'Closed swap' on ${CLOSED_DAY(2)}.`)).toBeVisible();
          await expect(page.getByText("You can still ask to be let in. Ngozi decides.")).toBeVisible();
          await expect(page.getByRole("link", { name: "Join this exchange" })).toHaveCount(0);
          await expectNoAxeViolations(page);
          await shot(page, "invite-closed-ask-signedout", width);
          await page.getByRole("link", { name: "Ask to join" }).click();
          await expect(page).toHaveURL(new RegExp(`/signup\\?next=${encodeURIComponent(`/i/${closed.token}/join`)}$`));
          await expect(page.getByText("You're joining Closed swap")).toBeVisible();
          // Nobody was added or asked by looking.
          expect(await requestStatuses(closed.id, organiser.id)).toEqual([]);
        } finally {
          await visitor.close();
        }
      });

      test("ask, wait, approve: the requester's pending row, the organiser's block, Participants, then the exchange appears", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await seed.newPerson("Ngozi");
        const chidi = await seed.newPerson("Chidi");
        const exchange = await seedExchange(organiser, "Approval swap", { approval: true });

        const asker = await signedIn(browser, viewport, chidi, `/i/${exchange.token}/join`);
        const host = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}`);
        try {
          const page = asker.page;
          // AC-1: the join confirmation with Ask to join; nothing is created before the tap.
          await expect(page.getByRole("heading", { name: "What you're agreeing to" })).toBeVisible();
          await expect(page.getByText("Ngozi, the organiser, can see your email address.")).toBeVisible();
          await expect(page.getByText("Ngozi approves everyone who joins, so this sends a request. Nobody else is told.")).toBeVisible();
          await expect(page.getByRole("button", { name: "Join exchange" })).toHaveCount(0);
          await expectNoAxeViolations(page);
          await shot(page, "ask-confirm", width);
          expect(await requestStatuses(exchange.id, chidi.id)).toEqual([]);

          await page.getByRole("button", { name: "Ask to join" }).click();
          // AC-8 / Q6: Request sent, no email or Home promise, the button goes to Exchanges.
          await expect(page.getByRole("heading", { level: 1, name: "Waiting for Ngozi" })).toBeVisible();
          await expect(page.getByText("Request sent", { exact: true })).toBeVisible();
          await expect(page.getByText("Ngozi has your request and will let you in.")).toBeVisible();
          await expect(page.locator("body")).not.toContainText(/email/i);
          await expect(page.locator("body")).not.toContainText(/\bHome\b/);
          await expect(page.getByRole("link", { name: "Go to Exchanges" })).toHaveAttribute("href", "/exchanges");
          await expectNoAxeViolations(page);
          await shot(page, "ask-sent", width);
          expect(await requestStatuses(exchange.id, chidi.id)).toEqual(["pending"]);
          expect(await memberStates(exchange.id, chidi.id)).toEqual([]);

          // AC-9: the pending row on Exchanges, with a label, and not a link.
          await page.getByRole("link", { name: "Go to Exchanges" }).click();
          await expect(page).toHaveURL(/\/exchanges$/);
          await expect(page.getByText("Request sent. Waiting for Ngozi.")).toBeVisible();
          await expect(page.getByRole("link", { name: /Approval swap/ })).toHaveCount(0);
          await expectNoAxeViolations(page);
          await shot(page, "exchanges-pending", width);

          // AC-6: opening the link again says so, and offers no second Ask.
          await page.goto(`/i/${exchange.token}`);
          await expect(page).toHaveURL(new RegExp(`/i/${exchange.token}/join$`));
          await expect(page.getByRole("heading", { level: 1, name: "You've already asked" })).toBeVisible();
          await expect(page.getByText("Your request to join 'Approval swap' is waiting for Ngozi.")).toBeVisible();
          await expect(page.getByRole("button", { name: "Ask to join" })).toHaveCount(0);
          await expectNoAxeViolations(page);
          await shot(page, "ask-already", width);
          expect(await requestStatuses(exchange.id, chidi.id)).toEqual(["pending"]);

          // GCO-006: the organiser's "Needs you now" block on the exchange page and on Exchanges.
          const hostPage = host.page;
          await hostPage.goto(`/exchanges/${exchange.id}`);
          await expect(hostPage.getByText("Needs you now")).toBeVisible();
          await expect(hostPage.getByRole("heading", { name: "Chidi wants to join." })).toBeVisible();
          await expect(hostPage.getByText("Approve or decline Chidi's request. People can join until")).toBeVisible();
          await expectNoAxeViolations(hostPage);
          await shot(hostPage, "exchange-request-block", width);
          await hostPage.goto("/exchanges");
          await expect(hostPage.getByRole("heading", { name: "Chidi wants to join." })).toBeVisible();
          await expectNoAxeViolations(hostPage);
          await shot(hostPage, "exchanges-request-block", width);

          // Review goes to Participants, where Approve and Decline live.
          await hostPage.getByRole("link", { name: "Review request" }).click();
          await expect(hostPage).toHaveURL(new RegExp(`/exchanges/${exchange.id}/participants$`));
          await expect(hostPage.getByRole("heading", { level: 1, name: "Participants" })).toBeVisible();
          await expect(hostPage.getByText("Approval swap · Only you so far")).toBeVisible();
          await expect(hostPage.getByRole("heading", { name: "Wants to join (1)" })).toBeVisible();
          // Organiser emails (owner decision 2026-11-15): the request row reads "{email} · Today at {time}".
          await expect(hostPage.getByText(`${chidi.email} · Today at`)).toBeVisible();
          await expect(hostPage.getByRole("button", { name: "Approve Chidi" })).toBeVisible();
          await expect(hostPage.getByRole("button", { name: "Decline Chidi" })).toBeVisible();
          // Board Org-People-alone: no privacy line while nobody else has joined.
          await expect(hostPage.getByText("Nobody can see who drew whom, not even you.")).toHaveCount(0);
          await expectNoAxeViolations(hostPage);
          await shot(hostPage, "participants-request", width);

          await hostPage.getByRole("button", { name: "Approve Chidi" }).click();
          await expect(toast(hostPage)).toContainText("Chidi is in. They've been emailed.");
          await expect(hostPage.getByRole("heading", { name: /Wants to join/ })).toHaveCount(0);
          await expect(hostPage.getByRole("heading", { name: "Still need a wishlist (2)" })).toBeVisible();
          await expect(hostPage.getByText("Ngozi (you)")).toBeVisible();
          // "Joined just now" until reload, between the address and the status; and the "1 more person needed" card.
          await expect(hostPage.getByText(`${chidi.email} · Joined just now · No wishlist yet`)).toBeVisible();
          await expect(hostPage.getByRole("heading", { name: "1 more person needed" })).toBeVisible();
          await expect(hostPage.getByRole("button", { name: "Invite more people" })).toHaveCount(0);
          await expect(hostPage.getByText("Nobody can see who drew whom, not even you.")).toBeVisible();
          await expectNoAxeViolations(hostPage);
          await shot(hostPage, "participants-approved", width);
          await hostPage.reload();
          await expect(hostPage.getByText(`${chidi.email} · No wishlist yet`)).toBeVisible();
          await expect(hostPage.getByText("Joined just now")).toHaveCount(0);
          expect(await requestStatuses(exchange.id, chidi.id)).toEqual(["approved"]);
          expect(await memberStates(exchange.id, chidi.id)).toEqual(["active"]);

          // The block is gone, and the requester's exchange is now a row they can open.
          await hostPage.goto(`/exchanges/${exchange.id}`);
          await expect(hostPage.getByText("Needs you now")).toHaveCount(0);
          await page.goto("/exchanges");
          await expect(page.getByRole("link", { name: /Approval swap/ })).toBeVisible();
          await expect(page.getByText("Request sent. Waiting for Ngozi.")).toHaveCount(0);
          await page.getByRole("link", { name: /Approval swap/ }).click();
          await expect(page.getByRole("heading", { level: 1, name: "Approval swap" })).toBeVisible();
        } finally {
          await asker.context.close();
          await host.context.close();
        }
      });

      test("decline: the row goes, the requester has nothing waiting and may ask again", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await seed.newPerson("Ngozi");
        const chidi = await seed.newPerson("Chidi");
        const exchange = await seedExchange(organiser, "Approval swap", { approval: true });
        await addRequest(exchange.id, chidi);

        const host = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}/participants`);
        const asker = await signedIn(browser, viewport, chidi, "/exchanges");
        try {
          await expect(asker.page.getByText("Request sent. Waiting for Ngozi.")).toBeVisible();
          const page = host.page;
          await expect(page.getByRole("heading", { name: "Wants to join (1)" })).toBeVisible();
          await page.getByRole("button", { name: "Decline Chidi" }).click();
          await expect(page.getByRole("heading", { name: /Wants to join/ })).toHaveCount(0);
          await expect(page.getByRole("heading", { level: 1, name: "Participants" })).toBeVisible();
          await expectNoAxeViolations(page);
          expect(await requestStatuses(exchange.id, chidi.id)).toEqual(["declined"]);
          expect(await memberStates(exchange.id, chidi.id)).toEqual([]);

          // Q8: nothing is said to the requester; the row simply goes.
          await asker.page.goto("/exchanges");
          await expect(asker.page.getByText("Request sent. Waiting for Ngozi.")).toHaveCount(0);
          await asker.page.goto(`/i/${exchange.token}/join`);
          await expect(asker.page.getByRole("button", { name: "Ask to join" })).toBeVisible();
          await asker.page.getByRole("button", { name: "Ask to join" }).click();
          await expect(asker.page.getByRole("heading", { level: 1, name: "Waiting for Ngozi" })).toBeVisible();
          expect(await requestStatuses(exchange.id, chidi.id)).toEqual(["declined", "pending"]);
        } finally {
          await asker.context.close();
          await host.context.close();
        }
      });

      test("joining closed: a person asks after the join-by day, the block says so, and Approve still lets them in", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await seed.newPerson("Ngozi");
        const chidi = await seed.newPerson("Chidi");
        const exchange = await seedExchange(organiser, "Closed swap");
        await closeJoining(exchange.id);

        const asker = await signedIn(browser, viewport, chidi, `/i/${exchange.token}/join`);
        const host = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}`);
        try {
          const page = asker.page;
          await expect(page.getByRole("heading", { level: 1, name: CANT_USE })).toBeVisible();
          await expect(page.getByText("You can still ask to be let in. Ngozi decides.")).toBeVisible();
          await expectNoAxeViolations(page);
          await shot(page, "ask-closed", width);
          await page.getByRole("button", { name: "Ask to join" }).click();
          await expect(page.getByRole("heading", { level: 1, name: "Waiting for Ngozi" })).toBeVisible();
          expect(await requestStatuses(exchange.id, chidi.id)).toEqual(["pending"]);

          const hostPage = host.page;
          await hostPage.goto(`/exchanges/${exchange.id}`);
          await expect(hostPage.getByRole("heading", { name: "Chidi wants to join." })).toBeVisible();
          await expect(hostPage.getByText(`Approve or decline Chidi's request. Joining closed on ${CLOSED_DAY(2)}.`)).toBeVisible();
          // Lowest priority: the closed card still shows below the request block.
          await expect(hostPage.getByText("New people can only ask to join now.")).toBeVisible();
          await expectNoAxeViolations(hostPage);
          await shot(hostPage, "exchange-request-block-closed", width);
          await hostPage.getByRole("link", { name: "Review request" }).click();
          await hostPage.getByRole("button", { name: "Approve Chidi" }).click();
          await expect(toast(hostPage)).toContainText("Chidi is in. They've been emailed.");
          expect(await memberStates(exchange.id, chidi.id)).toEqual(["active"]);
        } finally {
          await asker.context.close();
          await host.context.close();
        }
      });

      test("remove: Keep, then Remove; the stale link says they are no longer in; they ask again and are let back in", async ({ browser }) => {
        test.setTimeout(300_000);
        const organiser = await seed.newPerson("Ngozi");
        const femi = await seed.newPerson("Femi");
        const bisi = await seed.newPerson("Bisi");
        const exchange = await seedExchange(organiser, "Approval swap", { approval: true });
        await addMember(exchange.id, femi);
        await addMember(exchange.id, bisi);
        await attachWishlist(exchange.id, bisi);

        const host = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}/participants`);
        const removed = await signedIn(browser, viewport, femi, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          await expect(page.getByRole("heading", { name: "Still need a wishlist (2)" })).toBeVisible();
          await expect(page.getByRole("heading", { name: "Ready (1)" })).toBeVisible();
          await expect(page.getByText("Approval swap · 3 people taking part")).toBeVisible();
          // The organiser's own row has no Remove.
          await expect(page.getByRole("button", { name: /^Remove… / })).toHaveCount(2);
          await expectNoAxeViolations(page);
          await shot(page, "participants-default", width);

          const open = page.getByRole("button", { name: "Remove… Femi" });
          await open.click();
          const confirm = page.getByRole("alertdialog", { name: "Remove Femi from Approval swap?" });
          await expect(confirm).toBeVisible();
          // Board Org-Remove-before, exact: the organiser's own page names the address the email goes to (E12).
          await expect(
            confirm.getByText(`Femi gets a short email at ${femi.email} saying they're no longer in it. It doesn't give a reason or say who removed them. Their wishlist stays theirs.`),
          ).toBeVisible();
          await expectNoAxeViolations(page);
          await shot(page, "participants-remove-confirm", width);
          await confirm.getByRole("button", { name: "Keep" }).click();
          await expect(confirm).toBeHidden();
          await expect(open).toBeFocused();
          expect(await memberStates(exchange.id, femi.id)).toEqual(["active"]);

          await open.click();
          await confirm.getByRole("button", { name: "Remove Femi" }).click();
          await expect(toast(page)).toContainText("Femi was removed from Approval swap.");
          await expect(page.getByRole("heading", { name: "Still need a wishlist (1)" })).toBeVisible();
          await expect(page.getByRole("heading", { name: "1 more person needed" })).toBeVisible();
          await expect(page.getByRole("button", { name: "Remove… Femi" })).toHaveCount(0);
          await shot(page, "participants-removed", width);
          expect(await memberStates(exchange.id, femi.id)).toEqual(["removed"]);

          // AC-16 / Q15: the stale exchange link names the exchange and nothing else.
          const gone = removed.page;
          await gone.goto(`/exchanges/${exchange.id}`);
          await expect(gone.getByRole("heading", { level: 1, name: "You're no longer in Approval swap" })).toBeVisible();
          await expect(gone.getByText("Your wishlist is still yours to use.")).toBeVisible();
          await expect(gone.getByRole("link", { name: "Back to Home" })).toBeVisible();
          await expectNoAxeViolations(gone);
          await shot(gone, "exchange-removed", width);

          // The invite link offers only a request.
          await gone.goto(`/i/${exchange.token}`);
          await expect(gone).toHaveURL(new RegExp(`/i/${exchange.token}/join$`));
          await expect(gone.getByText("You can't join 'Approval swap' with this link. You can ask to be let in.")).toBeVisible();
          await expect(gone.getByRole("button", { name: "Join exchange" })).toHaveCount(0);
          await expectNoAxeViolations(gone);
          await shot(gone, "ask-removed", width);
          await gone.getByRole("button", { name: "Ask to join" }).click();
          await expect(gone.getByRole("heading", { level: 1, name: "Waiting for Ngozi" })).toBeVisible();

          // The organiser lets them back in.
          await page.reload();
          await expect(page.getByRole("heading", { name: "Wants to join (1)" })).toBeVisible();
          await page.getByRole("button", { name: "Approve Femi" }).click();
          await expect(toast(page)).toContainText("Femi is in. They've been emailed.");
          await expect.poll(async () => (await memberStates(exchange.id, femi.id)).includes("active")).toBe(true);
          await gone.goto(`/exchanges/${exchange.id}`);
          await expect(gone.getByRole("heading", { level: 1, name: "Approval swap" })).toBeVisible();
        } finally {
          await removed.context.close();
          await host.context.close();
        }
      });

      test("several requests: the block and the Invite people sheet say so, with the approval line", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await seed.newPerson("Ngozi");
        const chidi = await seed.newPerson("Chidi");
        const bisi = await seed.newPerson("Bisi");
        const femi = await seed.newPerson("Femi");
        const exchange = await seedExchange(organiser, "Approval swap", { approval: true });
        const plain = await seedExchange(organiser, "Plain swap");
        await addRequest(exchange.id, chidi);

        const host = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}`);
        try {
          const page = host.page;
          await expect(page.getByRole("heading", { name: "Chidi wants to join." })).toBeVisible();
          await page.getByRole("button", { name: /^Invite people/ }).click();
          const sheet = page.getByRole("dialog", { name: "Invite people" });
          await expect(sheet.getByText("You approve each person before they're in.")).toBeVisible();
          await expect(sheet.getByText("Chidi is waiting for you to let them in.")).toBeVisible();
          await expectNoAxeViolations(page);
          await shot(page, "invite-sheet-approval", width);
          await sheet.getByRole("button", { name: "Done" }).click();
          await expect(sheet).toBeHidden();

          await addRequest(exchange.id, bisi);
          await addRequest(exchange.id, femi);
          await page.reload();
          await expect(page.getByRole("heading", { name: "3 people want to join." })).toBeVisible();
          await expect(page.getByText("Chidi, Bisi and Femi are waiting for you to approve or decline them. People can join until")).toBeVisible();
          await expect(page.getByRole("link", { name: "Review 3 requests" })).toBeVisible();
          await expectNoAxeViolations(page);
          await shot(page, "exchange-request-block-many", width);
          await page.getByRole("button", { name: /^Invite people/ }).click();
          await expect(sheet.getByText("3 people are waiting for you to let them in.")).toBeVisible();
          await sheet.getByRole("button", { name: "Done" }).click();

          // Exchanges: the block names its exchange; the plain exchange has no approval line.
          await page.goto("/exchanges");
          await expect(page.getByRole("heading", { name: "3 people want to join." })).toBeVisible();
          await page.goto(`/exchanges/${plain.id}`);
          await page.getByRole("button", { name: /^Invite people/ }).click();
          await expect(sheet.getByText("People can join until")).toBeVisible();
          await expect(sheet.getByText("You approve each person before they're in.")).toHaveCount(0);
        } finally {
          await host.context.close();
        }
      });

      test("access: a member and an outsider get Not available, signed out goes to Log in; no request data reaches a member", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await seed.newPerson("Ngozi");
        const member = await seed.newPerson("Femi");
        const otherMember = await seed.newPerson("Bisi");
        const outsider = await seed.newPerson("Tolu");
        const chidi = await seed.newPerson("Chidi");
        const exchange = await seedExchange(organiser, "Approval swap", { approval: true });
        await addMember(exchange.id, member);
        await addMember(exchange.id, otherMember);
        await addRequest(exchange.id, chidi);
        const path = `/exchanges/${exchange.id}/participants`;

        const visitor = await browser.newContext({ viewport, timezoneId: ZONE });
        try {
          const page = await visitor.newPage();
          await page.goto(path);
          await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
        } finally {
          await visitor.close();
        }

        const asMember = await signedIn(browser, viewport, member, "/home");
        try {
          await asMember.page.goto(path);
          await expect(asMember.page.getByRole("heading", { level: 1, name: NOT_AVAILABLE })).toBeVisible();
          await expectNoAxeViolations(asMember.page);
          // AC-42 and organiser-emails: the member's exchange page and Participants carry no request data and no
          // other person's address (HTML and the RSC payload), though the organiser now sees them.
          for (const route of [path, `/exchanges/${exchange.id}`]) {
            for (const headers of [undefined, { RSC: "1" }]) {
              const html = await (await asMember.context.request.get(route, { headers })).text();
              const label = `${route}${headers ? " (rsc)" : ""}`;
              for (const secret of ["Chidi", "Needs you now", "wants to join", "Wants to join", chidi.email, chidi.id, organiser.email, otherMember.email, otherMember.id]) {
                expect(html, `${label} must not contain ${secret}`).not.toContain(secret);
              }
            }
          }
          await asMember.page.goto(`/exchanges/${exchange.id}`);
          await expect(asMember.page.getByRole("heading", { level: 1, name: "Approval swap" })).toBeVisible();
          await expect(asMember.page.getByText("Needs you now")).toHaveCount(0);
          await expect(asMember.page.getByRole("link", { name: "See all" })).toHaveCount(0);
        } finally {
          await asMember.context.close();
        }

        const asOutsider = await signedIn(browser, viewport, outsider, "/home");
        try {
          await asOutsider.page.goto(path);
          await expect(asOutsider.page.getByRole("heading", { level: 1, name: NOT_AVAILABLE })).toBeVisible();
          for (const headers of [undefined, { RSC: "1" }]) {
            const html = await (await asOutsider.context.request.get(path, { headers })).text();
            for (const secret of ["Approval swap", "Chidi", "Ngozi", exchange.token, organiser.email, member.email, otherMember.email, chidi.email]) {
              expect(html, `outsider ${headers ? "rsc" : "html"} must not contain ${secret}`).not.toContain(secret);
            }
          }
        } finally {
          await asOutsider.context.close();
        }
      });

      test("organiser emails: the organiser sees member and requester addresses; the exchange page and Exchanges carry none", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await seed.newPerson("Ngozi");
        const femi = await seed.newPerson("Femi");
        const bisi = await seed.newPerson("Bisi");
        const chidi = await seed.newPerson("Chidi");
        const exchange = await seedExchange(organiser, "Approval swap", { approval: true });
        await addMember(exchange.id, femi);
        await addMember(exchange.id, bisi);
        await attachWishlist(exchange.id, femi);
        await addRequest(exchange.id, chidi);

        const host = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}/participants`);
        try {
          const { page, context } = host;
          const path = `/exchanges/${exchange.id}/participants`;
          // A requirement change (owner decision 2026-11-15), not a weakening: this test used to assert the
          // organiser's page held no address. The member and outsider checks in the access test stay.
          await expect(page.getByRole("heading", { level: 1, name: "Participants" })).toBeVisible();
          await expect(page.getByText(`${chidi.email} · Today at`)).toBeVisible();
          await expect(page.getByText(`${femi.email} · Wishlist added`)).toBeVisible();
          await expect(page.getByText(`${bisi.email} · No wishlist yet`)).toBeVisible();
          await expect(page.getByRole("heading", { name: "Still need a wishlist (2)" })).toBeVisible();
          await expect(page.getByRole("heading", { name: "Ready (1)" })).toBeVisible();
          // Sub lines wrap: nothing runs past the screen, whatever the address length.
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow).toBeLessThanOrEqual(0);
          // The organiser's own row shows the status alone (owner Q2).
          const own = page.getByRole("listitem").filter({ hasText: "Ngozi (you)" });
          await expect(own).toContainText("No wishlist yet");
          await expect(own).not.toContainText("@");
          await expectNoAxeViolations(page);
          await shot(page, "participants-emails", width);

          const html = await (await context.request.get(path)).text();
          // WHY RSC: the flight payload is what the client actually receives for props.
          const rsc = await (await context.request.get(path, { headers: { RSC: "1" } })).text();
          // WHY a fresh load: after sign-in the page still holds the Verify screen's flight data (its own email field).
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          const dom = await page.content();
          for (const [label, body] of [["html", html], ["rsc", rsc], ["dom", dom]] as const) {
            for (const person of [femi, bisi, chidi]) {
              expect(body, `${label} holds ${person.first}'s address for the organiser`).toContain(person.email);
            }
            // The organiser's own row has no address, and no user id reaches the page.
            expect(body, `${label} must not contain the organiser's own address`).not.toContain(organiser.email);
            for (const person of [organiser, femi, bisi, chidi]) {
              expect(body, `${label} must not contain ${person.first}'s user id`).not.toContain(person.id);
            }
          }
          // No pairs on the page (AC-17).
          for (const word of ["gives to", "drew you"]) expect(dom).not.toContain(word);

          // The exchange page and Exchanges are names only.
          for (const route of [`/exchanges/${exchange.id}`, "/exchanges"]) {
            for (const headers of [undefined, { RSC: "1" }]) {
              const body = await (await context.request.get(route, { headers })).text();
              expect(body, `${route} must name the request`).toContain("Chidi");
              for (const person of [femi, bisi, chidi]) {
                expect(body, `${route}${headers ? " (rsc)" : ""} must not contain ${person.first}'s address`).not.toContain(person.email);
              }
            }
          }
        } finally {
          await host.context.close();
        }
      });

      test("alone and few: the alone card has no privacy line or invite button; two people show the 'more needed' card", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await seed.newPerson("Ngozi");
        const femi = await seed.newPerson("Femi");
        const exchange = await seedExchange(organiser, "Approval swap", { approval: true });

        const host = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}/participants`);
        try {
          const { page } = host;
          await expect(page.getByRole("heading", { name: "Nobody has joined yet" })).toBeVisible();
          await expect(page.getByText("Nobody can see who drew whom, not even you.")).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Invite more people" })).toHaveCount(0);
          await expectNoAxeViolations(page);
          await shot(page, "participants-alone", width);

          await addMember(exchange.id, femi);
          await page.reload();
          await expect(page.getByRole("heading", { name: "1 more person needed" })).toBeVisible();
          await expect(page.getByText(/^Names need at least 3 people to draw\. People can join until/)).toBeVisible();
          await expect(page.getByRole("button", { name: "Invite people" })).toBeVisible();
          await expect(page.getByRole("button", { name: "Invite more people" })).toHaveCount(0);
          await expect(page.getByText("Nobody can see who drew whom, not even you.")).toBeVisible();
          await expectNoAxeViolations(page);
          await shot(page, "participants-few", width);

          // With a third person the card goes and "Invite more people" (with its plus icon) takes its place.
          const bisi = await seed.newPerson("Bisi");
          await addMember(exchange.id, bisi);
          await page.reload();
          await expect(page.getByRole("heading", { name: /more person needed|more people needed/ })).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Invite more people" })).toBeVisible();
          await shot(page, "participants-default-three", width);
        } finally {
          await host.context.close();
        }
      });

      test("offline: Approve, Decline and Remove are disabled, and come back with the connection", async ({ browser }) => {
        test.setTimeout(240_000);
        const organiser = await seed.newPerson("Ngozi");
        const femi = await seed.newPerson("Femi");
        const chidi = await seed.newPerson("Chidi");
        const exchange = await seedExchange(organiser, "Approval swap", { approval: true });
        await addMember(exchange.id, femi);
        await addRequest(exchange.id, chidi);

        const host = await signedIn(browser, viewport, organiser, `/exchanges/${exchange.id}/participants`);
        try {
          const { page, context } = host;
          await page.waitForLoadState("networkidle");
          await expect(page.getByRole("button", { name: "Approve Chidi" })).toBeEnabled();
          await page.getByRole("button", { name: "Remove… Femi" }).click();
          const confirm = page.getByRole("alertdialog", { name: "Remove Femi from Approval swap?" });
          await expect(confirm.getByRole("button", { name: "Remove Femi" })).toBeEnabled();

          await context.setOffline(true);
          await expect(page.getByText(OFFLINE)).toBeVisible();
          await expect(confirm.getByRole("button", { name: "Remove Femi" })).toBeDisabled();
          await expect(confirm.getByText("You're offline. You can remove someone once you're back online.")).toBeVisible();
          await expectNoAxeViolations(page);
          await shot(page, "participants-remove-offline", width);
          await confirm.getByRole("button", { name: "Keep" }).click();
          await expect(page.getByRole("button", { name: "Approve Chidi" })).toBeDisabled();
          await expect(page.getByRole("button", { name: "Decline Chidi" })).toBeDisabled();
          await expect(page.getByRole("button", { name: "Remove… Femi" })).toBeDisabled();
          await shot(page, "participants-offline", width);

          await context.setOffline(false);
          await expect(page.getByText(OFFLINE)).toBeHidden();
          await expect(page.getByRole("button", { name: "Approve Chidi" })).toBeEnabled();
          await expect(page.getByRole("button", { name: "Decline Chidi" })).toBeEnabled();
          await expect(page.getByRole("button", { name: "Remove… Femi" })).toBeEnabled();
          expect(await requestStatuses(exchange.id, chidi.id)).toEqual(["pending"]);
          expect(await memberStates(exchange.id, femi.id)).toEqual(["active"]);
        } finally {
          await host.context.close();
        }
      });
    });
  });
}
