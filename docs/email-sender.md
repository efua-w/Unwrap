# Email sender: owner checklist (slice 7)

The email outbox has two halves:

- **The database** (migration `20261117053228_email_outbox.sql`, already applied to dev) queues each email in a table nobody can read through the API, and gives the sender two functions: `claim_due_emails` and `mark_email_result`. It enables `pg_net`. It does **not** create the schedule.
- **The Edge Function** `send-emails` (`supabase/functions/send-emails`) claims the due rows, renders the email, sends it through Resend and writes the result back. It is not deployed by any command in the repo: you do it.

Until you finish this list, rows wait in the outbox and nothing is sent. Nothing here changes the app's other behaviour.

Do the steps in order. Never paste a secret value into chat or a file in the repo.

## 1. Resend

1. Verify the sending domain in Resend (Domains). Until it is verified, Resend refuses any address that is not your own.
2. Make an API key for the sender (Resend, API Keys, "Sending access").

## 2. Deploy the function

From the repo root, signed in to the Supabase CLI (`npx supabase login`), once per project (dev: `ulziqspdjtjszvdcwdek`):

```
npx supabase functions deploy send-emails --project-ref <project-ref> --no-verify-jwt
```

`--no-verify-jwt` is needed because the caller is `pg_cron`, which has no user session. The function checks `EMAIL_SENDER_SECRET` itself and answers 401 to anyone else before it claims a row. (`supabase/config.toml` carries the same setting for local runs.)

## 3. Secrets

**Edge Function secrets** (Supabase dashboard, Edge Functions, Secrets, or `npx supabase secrets set NAME=value --project-ref <project-ref>`). Names:

| Name | What it is |
|---|---|
| `RESEND_API_KEY` | The Resend key from step 1. |
| `EMAIL_FROM` | The sender, on the verified domain, for example `Unwrap <hello@your-domain>`. |
| `APP_BASE_URL` | The origin links in emails use. Production: `https://unwrap.ink` (no path). Dev: the dev site's origin. |
| `EMAIL_SENDER_SECRET` | A long random string you make up. The cron job sends it, so only the job can run the function. |

The platform also gives every function `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; set nothing for those.

**Vault secret** (SQL editor of the project), the same value as `EMAIL_SENDER_SECRET`:

```sql
select vault.create_secret('<the same long random string>', 'email_sender_secret');
```

## 4. The schedule

Run once per project in the SQL editor, after steps 2 and 3. `pg_cron` must be enabled (Database, Extensions). Replace the project reference in the URL.

```sql
select cron.schedule(
  'send-emails',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_sender_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
```

To stop sending: `select cron.unschedule('send-emails');`. Rows stay in the outbox and go out when the job is back.

## 5. Check

1. `select jobname, schedule, active from cron.job where jobname = 'send-emails';` shows one active row.
2. After a minute: `select status_code from net._http_response order by created desc limit 1;` shows `200`. A `401` means the Vault secret and `EMAIL_SENDER_SECRET` differ. A `500` means a secret is missing (the body says `not_configured`; it never says which).
3. Do not select from `private.email_outbox` through the API (it refuses, by design). In the SQL editor, `select template, sent_at, cancelled_at, attempts, last_error_code from private.email_outbox order by created_at desc limit 20;` shows what was sent. `last_error_code` is a short code: `resend_<status>` (Resend refused it), `network`, `render_failed`, `unknown_template`, `bad_row`, `no_recipient` (the person was anonymised or has no address) or `gave_up` (five failures). Do not paste addresses anywhere.
4. End to end: as an organiser, send an invite to an address you own from Invite people. Within about two minutes the email arrives and its link opens `/i/{token}` on `APP_BASE_URL`.

## What the sender does and never does

- Delivery is at-least-once, not exactly once (reviewer R1-2). The row id is the Resend `Idempotency-Key`, and Resend honours a key for 24 hours, so a retry inside that window never sends a second email. A retry after more than 24 hours (a lease that lapses, then a late claim) could send a duplicate. Keep the retry window well under a day.
- It sends each row once: `claim_due_emails` leases a row for 10 minutes, the row id is the Resend `Idempotency-Key`, and a failed send is retried after `attempts x 2 minutes`, up to five times.
- It never logs an address, a subject or a body, and its answer holds counts only (`claimed`, `sent`, `failed`). Provider errors are stored as a short code, never as text.
- Emails in this slice: E06 invite, E07 someone joined, E08 request to join, E09 approved, E12 removed. E07 and E08 respect the organiser's "Someone joins" toggle; E06, E09 and E12 are always sent. No email names a giver and a recipient together, and no email carries an address other than its own recipient's.
