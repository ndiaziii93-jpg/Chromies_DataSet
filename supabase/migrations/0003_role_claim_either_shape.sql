-- Read the role claim from either shape of token.
--
-- The login edge function mints its own JWT with a top-level `app_role` claim.
-- Supabase Auth, where a project signs with asymmetric keys and the private key
-- is never exposed, puts custom claims under `app_metadata` instead. The
-- policies should not care which one is in use, so app_role() now accepts both.
--
-- Safe to run twice, and safe to run before either sign-in path is wired up:
-- with no token at all it still returns 'anon' and every policy denies.

create or replace function app_role() returns text
  language sql stable
  as $$
    select coalesce(
      auth.jwt() ->> 'app_role',
      auth.jwt() -> 'app_metadata' ->> 'app_role',
      'anon'
    )
  $$;
