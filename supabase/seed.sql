-- seed.sql — local/dev personas for security and e2e tests (slice 0b).
--
-- !!! NEVER RUN THIS ON PRODUCTION. !!!
-- It inserts fake users directly into auth.users. It is for `supabase db reset` (local and CI)
-- and, only with the owner's approval, the hosted DEV project.
--
-- WHY: security tests need real auth.uid() values to act as each role (CLAUDE.md "Core security
-- rule"). Fixed UUIDs let tests and later seeds refer to the same person. Addresses use the
-- reserved `.test` TLD so mail can never reach a real inbox, and there are no passwords: Auth is
-- email-code only (plan §6), so the encrypted_password column stays empty.
--
-- Contains no transaction statements, so it can be pasted inside a caller's begin/rollback.
-- Idempotent: re-running changes nothing.
--
-- Acting as a persona in a test (SET LOCAL lasts until the transaction ends; reset role to go
-- back to the owner). Helper functions are NOT created in `public`: they would show up in the
-- function allowlist test (030). Tests define theirs in pg_temp (see 050_seed_personas.sql):
--
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<persona uuid>","role":"authenticated"}';
--   ...
--   reset role;
--
-- Personas (plan §6 roles that need only a user; roles that need exchanges, such as requester,
-- former member and anonymised user, are added with the tables they depend on):
--   organiser    a0000000-0000-4000-8000-000000000001
--   participant  a0000000-0000-4000-8000-000000000002
--   giver        a0000000-0000-4000-8000-000000000003
--   receiver     a0000000-0000-4000-8000-000000000004
--   outsider     a0000000-0000-4000-8000-000000000005
-- "giver" and "receiver" become a pair only when a later slice draws an exchange between them.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', p.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'organiser@example.test'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'participant@example.test'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'giver@example.test'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'receiver@example.test'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'outsider@example.test')
) as p(id, email)
on conflict (id) do nothing;

-- WHY: an email identity row lets a persona sign in with an email code on a local stack.
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@example.test'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');
