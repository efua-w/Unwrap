import "server-only";
import { headers } from "next/headers";

// The address share links are built on (GC-022). WHY a server-only environment variable and no
// hard-coded domain: the production domain is not decided (open item), and every environment
// (local, preview, production) needs its own. WHY the request-host fallback is dev only: a Host
// header is attacker-controlled, so in production it must never decide the origin of a link a
// person then sends to others.
function clean(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function getSiteUrl(): Promise<string> {
  const configured = process.env.SITE_URL ? clean(process.env.SITE_URL) : null;
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      const fromHost = clean(`${proto}://${host}`);
      if (fromHost) return fromHost;
    }
  }
  throw new Error("Missing SITE_URL. Set it in .env.local (see .env.example).");
}

export async function buildShareUrl(token: string): Promise<string> {
  return `${await getSiteUrl()}/w/${token}`;
}

// The invite link an organiser shares (GCO-004): the exchange's token, on the same origin. The token is
// read only by the organiser (get_exchange_invite_token); joining by it is slice 5.
export async function buildInviteUrl(token: string): Promise<string> {
  return `${await getSiteUrl()}/i/${token}`;
}
