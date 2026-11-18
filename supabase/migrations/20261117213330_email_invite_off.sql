-- GCO-005 Invite by email is deferred to a later version (owner decision 2026-11-17, Tobechukwu Olih, after review).
-- WHY revoke instead of drop: the table, the function and the E06 template stay in place, unused, so re-enabling the
-- feature is one grant plus a per-address limit (reviewer R1-1), not a new schema. Revoking execute means nobody can
-- call the function, so an organiser cannot make the app send email to an address they type.
-- 230_email_invites proves authenticated callers now get 42501.
revoke execute on function public.send_email_invite(uuid, text) from authenticated;
