# Unwrap email templates: sign-in codes

These are the two Supabase Auth email templates, built from the design boards **E01 · Sign-up code** and **E02 · Log-in code** on the Unwrap design canvas. The copy, colours, type sizes and spacing come from the boards. Only the sample values ("Tolu", "482915") are swapped for Supabase variables.

- **Where they go:** Supabase dashboard → project `ulziqspdjtjszvdcwdek` → **Authentication → Emails → Templates**. Repeat on the production project before launch.
- **Variables:**
  - `{{ .Token }}` is the 6-digit code. Set **OTP length to 6** under Authentication → Providers → Email.
  - `{{ .Data.first_name }}` is the first name entered at sign-up, which Unwrap saves to the user's metadata.
- **No link and no button, by design (GC-003, GC-004).** The code is typed on the page where sign-up started, which keeps the session inside WhatsApp's in-app browser. Don't add `{{ .ConfirmationURL }}` or any other link.
- **Mandatory emails:** no unsubscribe link.
- **Leave the other templates as they are:** Change email, Reset password, Invite and Reauthentication. No screen sends them in v1.

| Supabase template | Board | Sent when | Subject | Preview text |
|---|---|---|---|---|
| **Confirm signup** | E01 · Sign-up code | Continue on Sign up (S03): a new account, or an unconfirmed one (an abandoned sign-up), which continues as a sign-up. Also sent when an unconfirmed account asks for a code from Log in | `{{ .Token }} is your Unwrap code` | Enter it to finish creating your account. |
| **Magic link** | E02 · Log-in code | Send code on Log in (S04): an existing account. Also sent from Sign up (S03) when the address already has a confirmed account: Sign up sends a log-in code, so that person receives this email and sees "Account exists" | `{{ .Token }} is your Unwrap code` | Enter it to log in. |

Both emails have the same subject on purpose, so people can search their inbox for "Unwrap code".

## Layout (both emails)

| Part | Desktop (600 wide) | Mobile (375 wide) |
|---|---|---|
| Page background | `#f7f7f7`, padding 32px 24px | `#f7f7f7`, padding 16px 8px 24px |
| Card | white, max-width 600px, corner radius 16px | same |
| Card side padding | 40px | 20px |
| Wordmark "Unwrap" | Bona Nova 700, 24px / 1.3, `#191a1c` | same |
| Heading | Bona Nova 400, 30px / 1.3, `#191a1c` | 24px |
| Greeting | Plus Jakarta Sans 16px / 1.5, `#191a1c` | same |
| Body text | 16px / 1.5, `#414347` | same |
| Code box | `#f7f7f7`, radius 12px, padding 16px 24px, 30px bold / 1.4, `#191a1c` | same |
| Safety note | 14px / 1.5, `#6b6b6e` | same |
| Sign-off | 16px / 1.5, `#191a1c` | same |
| Footer (outside the card) | 14px / 1.5, `#6b6b6e`, padding 24px 40px 0 | padding 24px 20px 0 |

**Fonts.** Bona Nova and Plus Jakarta Sans load only in mail apps that allow web fonts: Apple Mail, iOS Mail, Samsung Mail and Thunderbird. Gmail (web and app), Outlook and Yahoo block all web fonts, so in those apps the headings show in Georgia (Cambria on Windows) and the body text in the system font: San Francisco on Mac, Segoe UI on Windows, Roboto on Android. No code can change that. The only way to show the real typeface everywhere is to put text inside an image, which disappears when images are blocked and can't be read by screen readers, so these templates don't do it. The layout uses tables and inline styles so it renders in Gmail, Outlook and Yahoo. A small `<style>` block switches to the mobile padding and heading size below 480px.

## 1. Confirm signup (E01)

**Subject**

```
{{ .Token }} is your Unwrap code
```

**Message body (HTML)**

```html
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{ .Token }} is your Unwrap code</title>
<link href="https://fonts.googleapis.com/css2?family=Bona+Nova:wght@400;700&amp;family=Plus+Jakarta+Sans:wght@400;700&amp;display=swap" rel="stylesheet">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bona+Nova:wght@400;700&family=Plus+Jakarta+Sans:wght@400;700&display=swap');
  body { margin: 0; padding: 0; background: #f7f7f7; }
  @media (max-width: 480px) {
    .uw-outer { padding: 16px 8px 24px !important; }
    .uw-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .uw-h { font-size: 24px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background:#f7f7f7;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Enter it to finish creating your account.&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f7;">
  <tr>
    <td class="uw-outer" align="center" style="padding:32px 24px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border-radius:16px;">
        <tr>
          <td class="uw-pad" style="padding:32px 40px 16px; font-family:'Bona Nova', Georgia, Cambria, 'Times New Roman', serif; font-weight:700; font-size:24px; line-height:1.3; color:#191a1c;">Unwrap</td>
        </tr>
        <tr>
          <td class="uw-pad uw-h" style="padding:8px 40px 16px; font-family:'Bona Nova', Georgia, Cambria, 'Times New Roman', serif; font-weight:400; font-size:30px; line-height:1.3; color:#191a1c;">Here's your code</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.5; color:#191a1c;">Hi {{ .Data.first_name }},</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.5; color:#414347;">Use this code to finish creating your Unwrap account.</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px;">
            <span style="display:inline-block; background:#f7f7f7; border-radius:12px; padding:16px 24px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:30px; font-weight:700; line-height:1.4; color:#191a1c;">{{ .Token }}</span>
          </td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.5; color:#414347;">It works for 10 minutes. Type it on the page where you asked for it, and it checks itself once all 6 digits are in.</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:1.5; color:#6b6b6e;">Didn't try to sign up? You can ignore this email. Nobody can create an account with your address without this code.</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:8px 40px 32px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.5; color:#191a1c;">Thanks,<br>The Unwrap team</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td class="uw-pad" style="padding:24px 40px 0; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:1.5; color:#6b6b6e;">You're getting this because someone used this address to sign up for Unwrap.<br>Unwrap · Secret Santa, without the spreadsheet</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
```

## 2. Magic link (E02)

Supabase sends this template when an existing account asks for a log-in code. With OTP length 6 and no link in the body, it is a code-only log-in email.

**Subject**

```
{{ .Token }} is your Unwrap code
```

**Message body (HTML)**

```html
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{ .Token }} is your Unwrap code</title>
<link href="https://fonts.googleapis.com/css2?family=Bona+Nova:wght@400;700&amp;family=Plus+Jakarta+Sans:wght@400;700&amp;display=swap" rel="stylesheet">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bona+Nova:wght@400;700&family=Plus+Jakarta+Sans:wght@400;700&display=swap');
  body { margin: 0; padding: 0; background: #f7f7f7; }
  @media (max-width: 480px) {
    .uw-outer { padding: 16px 8px 24px !important; }
    .uw-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .uw-h { font-size: 24px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background:#f7f7f7;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Enter it to log in.&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f7;">
  <tr>
    <td class="uw-outer" align="center" style="padding:32px 24px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border-radius:16px;">
        <tr>
          <td class="uw-pad" style="padding:32px 40px 16px; font-family:'Bona Nova', Georgia, Cambria, 'Times New Roman', serif; font-weight:700; font-size:24px; line-height:1.3; color:#191a1c;">Unwrap</td>
        </tr>
        <tr>
          <td class="uw-pad uw-h" style="padding:8px 40px 16px; font-family:'Bona Nova', Georgia, Cambria, 'Times New Roman', serif; font-weight:400; font-size:30px; line-height:1.3; color:#191a1c;">Your log-in code</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.5; color:#191a1c;">Hi {{ .Data.first_name }},</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.5; color:#414347;">Here's the code to log in to Unwrap.</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px;">
            <span style="display:inline-block; background:#f7f7f7; border-radius:12px; padding:16px 24px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:30px; font-weight:700; line-height:1.4; color:#191a1c;">{{ .Token }}</span>
          </td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.5; color:#414347;">It works for 10 minutes. Type it on the page where you asked for it, and it checks itself once all 6 digits are in.</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:0 40px 16px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:1.5; color:#6b6b6e;">Didn't try to log in? You can ignore this email. Your account is safe without the code.</td>
        </tr>
        <tr>
          <td class="uw-pad" style="padding:8px 40px 32px; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.5; color:#191a1c;">Thanks,<br>The Unwrap team</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td class="uw-pad" style="padding:24px 40px 0; font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:1.5; color:#6b6b6e;">You're getting this because someone asked to log in to Unwrap with this address.<br>Unwrap · Secret Santa, without the spreadsheet</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
```

## Checks after pasting

1. Click **Save** on each template.
2. Sign up with an address you own. The email should show your first name, the 6-digit code and no link, and its subject should start with the code.
3. Log out, then log in with the same address. You should get the "Your log-in code" email.
4. Open both on a phone. Below 480px the side padding drops to 20px and the heading to 24px, as on the mobile boards.
