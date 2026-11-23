import { isEmailTemplate, type RenderedEmail, type RenderInput } from "../_shared/emails/types.ts";
import { renderEmail } from "../_shared/emails/render.ts";

// One run of the sender (slice 7, AC-13): claim due rows, render, send, write the result back.
// WHY the work is injected: the run is the same under Deno and under Vitest, and a test can prove that an
// outcome goes back as a short code and never as a message. WHY no logging in this file: a row carries an
// address, and a provider's error text can echo it (AC-13). Only counts leave a run.

export type DueRow = RenderInput & { id: string; attempts: number };

export type SendOutcome = { ok: true } | { ok: false; code: string };

export type Ports = {
  claim: (limit: number) => Promise<unknown[]>;
  /** `null` marks the row sent. Any other value is a short code and keeps the row for a retry. */
  mark: (id: string, errorCode: string | null) => Promise<void>;
  send: (rowId: string, to: string, email: RenderedEmail) => Promise<SendOutcome>;
  appBaseUrl: string;
};

export type RunSummary = { claimed: number; sent: number; failed: number };

export const CLAIM_LIMIT = 20;

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

// WHY a parse and not a cast: the row comes over the network. Anything unexpected becomes a failed row with a
// code, not a thrown error that would stop the rest of the batch.
export function parseDueRow(raw: unknown): { id: string; row: DueRow | null; code: string } {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const id = str(r.id) ?? "";
  const template = str(r.template);
  const toEmail = str(r.to_email);
  const exchangeId = str(r.exchange_id);
  const exchangeName = str(r.exchange_name);
  if (!id) return { id, row: null, code: "bad_row" };
  if (!template || !isEmailTemplate(template)) return { id, row: null, code: "unknown_template" };
  if (!toEmail || !exchangeId || !exchangeName) return { id, row: null, code: "bad_row" };
  return {
    id,
    code: "",
    row: {
      id,
      attempts: typeof r.attempts === "number" ? r.attempts : 0,
      template,
      toEmail,
      toName: str(r.to_name),
      exchangeId,
      exchangeName,
      otherName: str(r.other_name),
      inviteToken: str(r.invite_token),
      toTimezone: str(r.to_timezone) ?? "UTC",
      budgetPreset: str(r.budget_preset),
      joinByAt: str(r.join_by_at),
      giftDay: str(r.gift_day),
      note: str(r.note),
      scheduleMode: str(r.draw_mode),
      scheduleAt: str(r.draw_at),
      peopleCount: typeof r.people_count === "number" ? r.people_count : null,
    },
  };
}

export async function runSender(ports: Ports): Promise<RunSummary> {
  const rows = await ports.claim(CLAIM_LIMIT);
  const summary: RunSummary = { claimed: rows.length, sent: 0, failed: 0 };

  for (const raw of rows) {
    const parsed = parseDueRow(raw);
    if (!parsed.id) {
      summary.failed += 1;
      continue;
    }
    let code: string | null = parsed.code || null;
    if (parsed.row) {
      let email: RenderedEmail | null = null;
      try {
        email = renderEmail(parsed.row, ports.appBaseUrl);
      } catch {
        code = "render_failed";
      }
      if (email) {
        const outcome = await ports.send(parsed.id, parsed.row.toEmail, email);
        code = outcome.ok ? null : outcome.code;
      }
    }
    try {
      await ports.mark(parsed.id, code);
      if (code === null) summary.sent += 1;
      else summary.failed += 1;
    } catch {
      // WHY counted as failed and not retried here: the lease keeps the row out of the next runs for 10 minutes,
      // and Resend's Idempotency-Key (the row id) stops a second send in that window from reaching the person.
      summary.failed += 1;
    }
  }
  return summary;
}
