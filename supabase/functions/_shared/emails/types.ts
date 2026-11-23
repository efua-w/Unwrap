// What the email templates may read (slice 7, AC-2). WHY a narrow type and not a database row: a template
// cannot print what its input has no field for. There is no pair, giver, receiver, reservation, wishlist
// or item here (E19 and E21 carry a count of people and nothing that says who gives to whom), and the only address is the recipient's own (`toEmail`), which only E06's footer prints.

export const EMAIL_TEMPLATES = ["E06", "E07", "E08", "E09", "E10", "E12", "E19", "E21"] as const;
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
  /** E07 and E08: the person who joined or asked. E06: the inviter. E10: the organiser who nudged. E19: the organiser. Null for E09, E12 and E21 (GCO-007). */
  otherName: string | null;
  /** E06 only. */
  inviteToken: string | null;
  /** The recipient's zone (the organiser's, for an invitee with no account). Dates are shown in it. */
  toTimezone: string;
  /** E06, E19 and E21: what the invite page already shows (budget, gift day). E06 adds join-by and the organiser's note. */
  budgetPreset: string | null;
  joinByAt: string | null;
  giftDay: string | null;
  note: string | null;
  /**
   * E10 only: when names are drawn, so the email can say "on {day}" or "when {organiser} is ready" (owner 2026-11-18).
   * WHY not called draw*: this is the schedule the organiser chose, never a result of the draw.
   */
  scheduleMode: string | null;
  scheduleAt: string | null;
  /** E21 only: how many people the draw covered (GCO-012). A count, never who. */
  peopleCount: number | null;
};

export type RenderedEmail = {
  subject: string;
  /** The inbox preview line. */
  preview: string;
  html: string;
  text: string;
};
