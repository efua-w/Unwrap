// Links in an email, built on APP_BASE_URL (Q5) from routes that already exist. WHY ids and tokens are
// checked: a malformed value throws, so the row fails with a code instead of sending a broken link.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_TOKEN = /^[0-9a-f]{32}$/;

export function cleanBaseUrl(raw: string): string {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("base_url");
  return url.origin;
}

function exchangeId(id: string): string {
  if (!UUID.test(id)) throw new Error("exchange_id");
  return id;
}

export function inviteLink(base: string, token: string): string {
  if (!INVITE_TOKEN.test(token)) throw new Error("invite_token");
  return `${cleanBaseUrl(base)}/i/${token}`;
}

export function exchangeLink(base: string, id: string): string {
  return `${cleanBaseUrl(base)}/exchanges/${exchangeId(id)}`;
}

export function revealLink(base: string, id: string): string {
  return `${cleanBaseUrl(base)}/exchanges/${exchangeId(id)}/reveal`;
}

export function participantsLink(base: string, id: string): string {
  return `${cleanBaseUrl(base)}/exchanges/${exchangeId(id)}/participants`;
}

export function notificationsLink(base: string): string {
  return `${cleanBaseUrl(base)}/profile/notifications`;
}
