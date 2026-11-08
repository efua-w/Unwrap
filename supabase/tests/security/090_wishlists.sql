-- 090_wishlists — slice 2 (GC-018, GC-019, GC-020; plan §5 "wishlists", §6 invariants 7 and 10).
-- Self-contained: creates its own users inside the transaction (needs the profiles and wishlists
-- migrations applied, not seed.sql), so it runs as plain SQL on the hosted dev project and under
-- `supabase test db`. Everything rolls back.
-- Pass: "ok 1".."ok 48", "1..48", no "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(48);

-- WHY: helpers live in pg_temp so nothing is left in `public` (it would break the function
-- allowlist test 030). Same helpers as 060: try_as runs one statement as a persona (null = anon)
-- and reports 'ok:<rows>' or 'err:<SQLSTATE>'; val_as returns one value read as that persona.
-- WHY the nested block: the role switch stays outside it, so catching an error does not undo it.
create function pg_temp.try_as(who uuid, stmt text) returns text
language plpgsql as $$
declare
  n bigint;
begin
  if who is null then
    set local role anon;
    set local request.jwt.claims = '{"role":"anon"}';
  else
    set local role authenticated;
    execute format('set local request.jwt.claims = %L',
      json_build_object('sub', who, 'role', 'authenticated')::text);
  end if;
  begin
    execute stmt;
    get diagnostics n = row_count;
    reset role;
    return 'ok:' || n;
  exception when others then
    reset role;
    return 'err:' || sqlstate;
  end;
end $$;

create function pg_temp.val_as(who uuid, expr text) returns text
language plpgsql as $$
declare
  v text;
begin
  set local role authenticated;
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', who, 'role', 'authenticated')::text);
  begin
    execute format('select (%s)::text', expr) into v;
    reset role;
    return v;
  exception when others then
    reset role;
    return 'err:' || sqlstate;
  end;
end $$;

-- No passwords, no real addresses: the .test TLD can never reach an inbox.
create function pg_temp.mk_user(uid uuid, mail text, meta jsonb) returns void
language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, meta, now(), now(), '', '', '', ''
  )
$$;

-- Ada (owner) and Bola (another signed-in person).
select pg_temp.mk_user('b0000000-0000-4000-8000-000000000901', 'ada-090@example.test', '{"first_name":"Ada"}');
select pg_temp.mk_user('b0000000-0000-4000-8000-000000000902', 'bola-090@example.test', '{"first_name":"Bola"}');

-- 1-3. Shape: RLS on; the owner FK has no cascade (never-do 8: no destructive cascade); share
-- tokens are unique.
select ok((select relrowsecurity from pg_class where oid = 'public.wishlists'::regclass),
  'wishlists has row level security enabled');
select is(
  (select confdeltype::text from pg_constraint
   where conrelid = 'public.wishlists'::regclass and contype = 'f'
     and confrelid = 'public.profiles'::regclass),
  'a', 'wishlists.owner_id references profiles with no action on delete (no cascade)');
select ok(exists (
  select 1 from pg_index i
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
  where i.indrelid = 'public.wishlists'::regclass and i.indisunique and i.indnatts = 1
    and a.attname = 'share_token'),
  'share_token has a unique index');

-- 4-6. A visitor is refused outright, and only signed-in people may call the wishlist functions.
select is(pg_temp.try_as(null, 'select 1 from public.wishlists'), 'err:42501', 'anon cannot read wishlists');
select ok(
  not has_function_privilege('anon', 'public.delete_wishlist(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.restore_wishlist(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.remove_wishlist_item(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.restore_wishlist_item(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.has_deleted_wishlists()', 'execute'),
  'anon cannot execute any wishlist function');
select ok(
  has_function_privilege('authenticated', 'public.delete_wishlist(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.restore_wishlist(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.remove_wishlist_item(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.restore_wishlist_item(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.has_deleted_wishlists()', 'execute'),
  'authenticated can execute the wishlist functions');

-- 7-10. Create (GC-019): only the name and visibility come from the client; the rest are defaults.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name) values ('Birthday list')$$),
  'ok:1', 'a user can create a wishlist with just a name');
select is(
  (select format('%s/%s/%s/%s', (owner_id = 'b0000000-0000-4000-8000-000000000901')::text, kind, visibility, (deleted_at is null)::text)
   from public.wishlists where name = 'Birthday list'),
  'true/personal/private/true', 'a new list is owned by the caller, personal, Private and live');
select ok((select share_token ~ '^[0-9a-f]{32}$' from public.wishlists where name = 'Birthday list'),
  'the share token is 32 hex characters (128 random bits)');
select set_config('test.bday_id', (select id::text from public.wishlists where name = 'Birthday list'), true);
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name, visibility) values ('New flat', 'link')$$),
  'ok:1', 'a user can create a list visible to anyone with the link');

-- 11. Each list gets its own token.
select is(
  (select count(distinct share_token)::int from public.wishlists where owner_id = 'b0000000-0000-4000-8000-000000000901'),
  2, 'two lists get two different share tokens');

-- 12-15. Column grants on insert: owner, kind, token and deleted_at are never client-written.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name, owner_id) values ('Theirs', 'b0000000-0000-4000-8000-000000000902')$$),
  'err:42501', 'a user cannot set owner_id (no create on behalf of someone else)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name, kind) values ('Ideas', 'exchange_ideas')$$),
  'err:42501', 'a user cannot set kind (ideas lists are made by the join flow, slice 5)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name, share_token) values ('Mine', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$),
  'err:42501', 'a user cannot choose a share token');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name, deleted_at) values ('Mine', now())$$),
  'err:42501', 'a user cannot write deleted_at on insert');

-- 16-19. Column grants on update.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$update public.wishlists set owner_id = 'b0000000-0000-4000-8000-000000000902' where name = 'Birthday list'$$),
  'err:42501', 'a user cannot move a list to another owner');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$update public.wishlists set share_token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' where name = 'Birthday list'$$),
  'err:42501', 'a user cannot change a share token');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$update public.wishlists set deleted_at = now() where name = 'Birthday list'$$),
  'err:42501', 'a user cannot write deleted_at directly (delete goes through delete_wishlist)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$update public.wishlists set kind = 'exchange_ideas' where name = 'Birthday list'$$),
  'err:42501', 'a user cannot change kind');

-- 20-23. Owner-only: another signed-in person sees and changes nothing (GC-018 edge case).
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000902',
  $$select 1 from public.wishlists where owner_id = 'b0000000-0000-4000-8000-000000000901'$$),
  'ok:0', 'another user cannot read someone else''s lists');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000902',
  $$update public.wishlists set name = 'Hacked' where owner_id = 'b0000000-0000-4000-8000-000000000901'$$),
  'ok:0', 'another user cannot rename someone else''s list');
select is((select count(*)::int from public.wishlists where name = 'Hacked'), 0, 'the other user''s rename changed nothing');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000902',
  format('select public.delete_wishlist(%L)', current_setting('test.bday_id'))),
  'err:P0002', 'another user cannot delete someone else''s list (reported as not found)');

-- 24-28. Name rules (GC-019): 1 to 60 code points, no surrounding spaces; two visibility values.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name) values ('   ')$$), 'err:23514', 'a blank list name is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name) values (repeat('a', 61))$$), 'err:23514', 'a 61-character list name is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name) values (' Padded')$$), 'err:23514', 'a list name with surrounding spaces is refused');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name) values (repeat(chr(127873), 60))$$),
  'ok:1', 'a 60-emoji list name is accepted (counted in code points, not bytes)');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$insert into public.wishlists (name, visibility) values ('Mine', 'public')$$),
  'err:22P02', 'an unknown visibility is refused');

-- 29-30. The owner can rename and change visibility; there is no hard delete.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$update public.wishlists set name = 'Birthday — 14 March', visibility = 'link' where name = 'Birthday list'$$),
  'ok:1', 'the owner can rename a list and change who can see it');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$delete from public.wishlists where name = 'Birthday — 14 March'$$),
  'err:42501', 'a user cannot hard-delete a list (no DELETE grant)');

-- 31. An ideas list can never be shared by link (plan §5, invariant 7). Inserted as the migration
-- role, because clients cannot create ideas lists at all.
select throws_ok(
  $$insert into public.wishlists (owner_id, kind, name, visibility)
    values ('b0000000-0000-4000-8000-000000000901', 'exchange_ideas', 'Ideas', 'link')$$,
  '23514', null, 'an exchange_ideas list cannot be visible by link');

-- An ideas list fixture (private), for the delete/update rules below.
insert into public.wishlists (id, owner_id, kind, name)
values ('c0000000-0000-4000-8000-000000000901', 'b0000000-0000-4000-8000-000000000901', 'exchange_ideas', 'Ideas');

-- 32-33. Ideas lists are not managed from My wishlists: no rename, no delete through these paths.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$update public.wishlists set name = 'Renamed' where id = 'c0000000-0000-4000-8000-000000000901'$$),
  'ok:0', 'the owner cannot rename an exchange ideas list from the wishlist pages');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$select public.delete_wishlist('c0000000-0000-4000-8000-000000000901')$$),
  'err:P0002', 'delete_wishlist refuses an exchange ideas list');

-- Remember Birthday's updated_at before delete and restore.
select set_config('test.bday_updated', (select updated_at::text from public.wishlists where name = 'Birthday — 14 March'), true);

-- 34. updated_at moved on the rename (wall clock, so it moves inside one transaction).
select ok((select updated_at > created_at from public.wishlists where id = current_setting('test.bday_id')::uuid),
  'renaming a list moves updated_at');

-- 35-41. Soft delete with Undo (GC-019, GC-030): nothing cascades, restore is exact.
select is(pg_temp.val_as('b0000000-0000-4000-8000-000000000901', 'public.has_deleted_wishlists()'),
  'false', 'has_deleted_wishlists is false before any delete');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  format('select public.delete_wishlist(%L)', current_setting('test.bday_id'))),
  'ok:1', 'the owner can delete their list');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  format('select 1 from public.wishlists where id = %L', current_setting('test.bday_id'))),
  'ok:0', 'a deleted list is hidden from its owner');
select ok((select deleted_at is not null from public.wishlists where id = current_setting('test.bday_id')::uuid),
  'the row is kept with deleted_at set (soft delete)');
select is(
  pg_temp.val_as('b0000000-0000-4000-8000-000000000901', 'public.has_deleted_wishlists()')
    || '/' || pg_temp.val_as('b0000000-0000-4000-8000-000000000902', 'public.has_deleted_wishlists()'),
  'true/false', 'has_deleted_wishlists is true for the owner only');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  format('update public.wishlists set name = %L where id = %L', 'Renamed', current_setting('test.bday_id'))),
  'ok:0', 'a deleted list cannot be renamed');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  format('select public.delete_wishlist(%L)', current_setting('test.bday_id'))),
  'err:P0002', 'deleting an already deleted list is reported as not found');

-- 42-45. Restore (Undo): only the owner, only a deleted list, and updated_at is unchanged.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000902',
  format('select public.restore_wishlist(%L)', current_setting('test.bday_id'))),
  'err:P0002', 'another user cannot restore someone else''s list');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  format('select public.restore_wishlist(%L)', current_setting('test.bday_id'))),
  'ok:1', 'the owner can restore their deleted list');
select is(
  (select format('%s/%s/%s', (deleted_at is null)::text, visibility, (updated_at::text = current_setting('test.bday_updated'))::text)
   from public.wishlists where id = current_setting('test.bday_id')::uuid),
  'true/link/true', 'restore brings the list back exactly as it was, with the same updated_at');
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  format('select public.restore_wishlist(%L)', current_setting('test.bday_id'))),
  'err:P0002', 'restoring a live list is reported as not found');

-- 46. An unknown id is not found, not an error that says more.
select is(pg_temp.try_as('b0000000-0000-4000-8000-000000000901',
  $$select public.delete_wishlist('c0000000-0000-4000-8000-0000000009ff')$$),
  'err:P0002', 'deleting an unknown id is reported as not found');

-- 47. R1-5: a deleted exchange ideas list does not count for has_deleted_wishlists (the function only
-- looks at personal lists, so Bola, whose only deleted list is an ideas list, gets false).
insert into public.wishlists (owner_id, kind, name, deleted_at)
values ('b0000000-0000-4000-8000-000000000902', 'exchange_ideas', 'Bola ideas', now());
select is(pg_temp.val_as('b0000000-0000-4000-8000-000000000902', 'public.has_deleted_wishlists()'),
  'false', 'has_deleted_wishlists ignores a deleted exchange ideas list');

-- 48. R1-5: the share token is server-made even for a privileged insert (the trigger overwrites it).
insert into public.wishlists (owner_id, name, share_token)
values ('b0000000-0000-4000-8000-000000000901', 'Token check', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
select ok(
  (select share_token <> 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' and share_token ~ '^[0-9a-f]{32}$'
   from public.wishlists where name = 'Token check'),
  'a share token sent on a privileged insert is overwritten with a random one');

select * from finish();
rollback;
