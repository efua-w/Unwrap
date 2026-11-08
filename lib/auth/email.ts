const MAX_EMAIL = 254;

// WHY: a light check on purpose. The address is proven by the code that arrives there; this only
// catches a typo before a code is spent (S03 "That email looks incomplete").
export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  return email.length <= MAX_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
