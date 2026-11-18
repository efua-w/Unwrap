// WHY a shared secret and not the platform's JWT check (AC-13): the caller is pg_cron through pg_net, which
// holds a Vault secret and no user session. The function is deployed with --no-verify-jwt and checks the
// secret here, so anyone else who finds the URL is refused before any row is claimed.
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  return match?.[1] ?? null;
}

// Compares in constant time so the answer does not leak how many leading characters matched.
export function secretsMatch(given: string | null, expected: string): boolean {
  if (given === null || expected === "") return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
