// What the email templates may read (slice 7, AC-2). WHY a narrow type and not a database row: a template
// cannot print what its input has no field for. There is no draw, pair, giver, receiver, reservation, wishlist
// or item here, and the only address is the recipient's own (`toEmail`), which only E06's footer prints.

export const EMAIL_TEMPLATES = ["E06", "E07", "E08", "E09", "E12"] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export function isEmailTemplate(value: string): value is EmailTemplate {
  return (EMAIL_TEMPLATES as readonly string[]).includes(value);
}

export type RenderInput = {
  template: EmailTemplate;
  /** The recipient's display name (Q12). Null for E06: the invitee may have no account. */
  toName: string | null;
  /** The recipient's own address. Only E06 prints it. */
  toEmail: string;
  exchangeId: string;
  exchangeName: string;
  /** E07 and E08: the person who joined or asked. E06: the inviter. Null for E09 and E12 (GCO-007). */
  otherName: string | null;
  /** E06 only. */
  inviteToken: string | null;
  /** The recipient's zone (the organiser's, for an invitee with no account). Dates are shown in it. */
  toTimezone: string;
  /** E06 only: what the invite page already shows (budget, join-by, gift day) and the organiser's note. */
  budgetPreset: string | null;
  joinByAt: string | null;
  giftDay: string | null;
  note: string | null;
};

export type RenderedEmail = {
  subject: string;
  /** The inbox preview line. */
  preview: string;
  html: string;
  text: string;
};
