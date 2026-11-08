export const OTP_LENGTH = 6;

// Keeps only the digits, and only the first six: what a typed, pasted or autofilled value becomes.
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, "").slice(0, OTP_LENGTH);
}
