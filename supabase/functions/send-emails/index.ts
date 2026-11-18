import { bearerToken, secretsMatch } from "./auth.ts";
import { runSender, type Ports, type SendOutcome } from "./process.ts";
import { cleanBaseUrl } from "../_shared/emails/links.ts";

// The email sender (slice 7; GC-026, GCO-005, GCO-007). Called every minute by pg_cron through pg_net
// (docs/email-sender.md). Deployed with --no-verify-jwt: it checks EMAIL_SENDER_SECRET itself.
// WHY nothing is logged and nothing but counts is returned (AC-13): rows carry addresses, and a provider's
// error text can echo one. A failed send is recorded as a short code on the row (mark_email_result).
//
// Environment, names only (the owner sets the values; docs/email-sender.md):
//   RESEND_API_KEY, APP_BASE_URL, EMAIL_FROM, EMAIL_SENDER_SECRET
// and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, which the platform provides to every Edge Function.

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method" });

  const secret = Deno.env.get("EMAIL_SENDER_SECRET") ?? "";
  if (!secretsMatch(bearerToken(request.headers.get("Authorization")), secret)) return json(401, { error: "unauthorised" });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  const baseRaw = Deno.env.get("APP_BASE_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!resendKey || !from || !baseRaw || !supabaseUrl || !serviceKey) return json(500, { error: "not_configured" });
  let appBaseUrl: string;
  try {
    appBaseUrl = cleanBaseUrl(baseRaw);
  } catch {
    return json(500, { error: "not_configured" });
  }

  const rpc = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(args),
    });
    // WHY the status only: the body of a failed call is never read into an error.
    if (!response.ok) throw new Error(`rpc_${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };

  const ports: Ports = {
    appBaseUrl,
    claim: async (limit) => {
      const rows = await rpc("claim_due_emails", { p_limit: limit });
      return Array.isArray(rows) ? rows : [];
    },
    mark: async (id, errorCode) => {
      await rpc("mark_email_result", { p_id: id, p_error_code: errorCode });
    },
    send: async (rowId, to, email): Promise<SendOutcome> => {
      try {
        const response = await fetch(RESEND_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
            // WHY the row id (AC-13, exactly once): a retry after a lost response is the same send to Resend.
            "Idempotency-Key": rowId,
          },
          body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html, text: email.text }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        return response.ok ? { ok: true } : { ok: false, code: `resend_${response.status}` };
      } catch {
        return { ok: false, code: "network" };
      }
    },
  };

  try {
    return json(200, await runSender(ports));
  } catch {
    // The claim itself failed: nothing was leased, so the next run tries again.
    return json(500, { error: "claim_failed" });
  }
});
