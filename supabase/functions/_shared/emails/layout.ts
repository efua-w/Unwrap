import { escapeHtml } from "./escape.ts";

// The E01/E02 layout (docs/email-templates.md): tables and inline styles so it renders in Gmail, Outlook
// and Yahoo; a small <style> block switches to the mobile padding below 480px. Colours are literal here on
// purpose: email clients have no design tokens.
const SANS = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "'Bona Nova', Georgia, Cambria, 'Times New Roman', serif";
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bona+Nova:wght@400;700&amp;family=Plus+Jakarta+Sans:wght@400;700&amp;display=swap";

export type EmailContent = {
  preview: string;
  heading: string;
  greeting: string;
  /** Body paragraphs, plain text. The layout escapes them. */
  paragraphs: readonly string[];
  /** Label and value rows (E06), shown after the first paragraph. A value may hold line breaks. */
  details?: readonly { label: string; value: string }[];
  cta?: { label: string; url: string };
  /** A short muted line after the button and its fallback link (E19). */
  tip?: string;
  signoff: string;
  /** Footer reason line, then the optional settings link (E07, E08), then the product line. */
  reason: string;
  settings?: { label: string; url: string };
};

const NEWLINE = /\r?\n/g;
const PRODUCT_LINE = "Unwrap · Secret Santa, without the spreadsheet";

function cell(padding: string, style: string, inner: string, classes = "uw-pad"): string {
  return `<tr><td class="${classes}" style="padding:${padding}; ${style}">${inner}</td></tr>`;
}

const body = (colour: string) => `font-family:${SANS}; font-size:16px; line-height:1.5; color:${colour};`;

export function renderHtml(c: EmailContent): string {
  const rows: string[] = [
    cell("32px 40px 16px", `font-family:${SERIF}; font-weight:700; font-size:24px; line-height:1.3; color:#191a1c;`, "Unwrap"),
    cell(
      "8px 40px 16px",
      `font-family:${SERIF}; font-weight:400; font-size:30px; line-height:1.3; color:#191a1c;`,
      escapeHtml(c.heading),
      "uw-pad uw-h",
    ),
    cell("0 40px 16px", body("#191a1c"), escapeHtml(c.greeting)),
  ];
  c.paragraphs.forEach((p, i) => {
    rows.push(cell("0 40px 16px", body("#414347"), escapeHtml(p)));
    if (i === 0 && c.details && c.details.length > 0) {
      const lines = c.details.map(
        (d) =>
          `<span style="display:block; font-size:14px; line-height:1.5; color:#6b6b6e;">${escapeHtml(d.label)}</span><span style="display:block; padding-bottom:12px; font-size:16px; line-height:1.5; color:#191a1c;">${escapeHtml(d.value).replace(NEWLINE, "<br>")}</span>`,
      );
      rows.push(cell("0 40px 4px", body("#191a1c"), lines.join("")));
    }
  });
  if (c.cta) {
    const url = escapeHtml(c.cta.url);
    rows.push(
      cell(
        "8px 40px 16px",
        "",
        `<a href="${url}" style="display:inline-block; background:#191a1c; color:#ffffff; border-radius:999px; padding:14px 24px; font-family:${SANS}; font-size:16px; font-weight:700; line-height:1.5; text-decoration:none;">${escapeHtml(c.cta.label)}</a>`,
      ),
      cell(
        "0 40px 16px",
        `font-family:${SANS}; font-size:14px; line-height:1.5; color:#6b6b6e;`,
        `Button not working? Paste this link into your browser:<br><a href="${url}" style="color:#191a1c; word-break:break-all;">${url}</a>`,
      ),
    );
  }
  if (c.tip) rows.push(cell("0 40px 16px", body("#414347"), escapeHtml(c.tip)));
  rows.push(cell("8px 40px 32px", body("#191a1c"), `${escapeHtml(c.signoff)}<br>The Unwrap team`));

  const footerStyle = `font-family:${SANS}; font-size:14px; line-height:1.5; color:#6b6b6e;`;
  const settings = c.settings
    ? `<br><a href="${escapeHtml(c.settings.url)}" style="color:#191a1c;">${escapeHtml(c.settings.label)}</a>`
    : "";
  const footer = `${escapeHtml(c.reason)}${settings}<br>${escapeHtml(PRODUCT_LINE)}`;

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(c.heading)}</title>
<link href="${FONTS_HREF}" rel="stylesheet">
<style>
  body { margin: 0; padding: 0; background: #f7f7f7; }
  @media (max-width: 480px) {
    .uw-outer { padding: 16px 8px 24px !important; }
    .uw-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .uw-h { font-size: 24px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background:#f7f7f7;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${escapeHtml(c.preview)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f7;">
  <tr>
    <td class="uw-outer" align="center" style="padding:32px 24px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border-radius:16px;">
        ${rows.join("\n        ")}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        ${cell("24px 40px 0", footerStyle, footer)}
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

export function renderText(c: EmailContent): string {
  const lines = [c.heading, "", c.greeting, ""];
  c.paragraphs.forEach((p, i) => {
    lines.push(p, "");
    if (i === 0 && c.details) for (const d of c.details) lines.push(`${d.label}: ${d.value}`, "");
  });
  if (c.cta) lines.push(`${c.cta.label}: ${c.cta.url}`, "");
  if (c.tip) lines.push(c.tip, "");
  lines.push(c.signoff, "The Unwrap team", "", c.reason);
  if (c.settings) lines.push(`${c.settings.label}: ${c.settings.url}`);
  lines.push(PRODUCT_LINE, "");
  return lines.join("\n");
}
