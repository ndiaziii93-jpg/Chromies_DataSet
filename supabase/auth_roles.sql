-- Stamp the three accounts with the role the RLS policies read.
--
-- Run this AFTER creating the three users in Authentication → Users, and
-- BEFORE anyone signs in: `app_metadata` is copied into the access token when
-- the token is issued, so a session opened before this runs carries no role.
--
-- Contains no secrets: the passcodes are the accounts' passwords and are set in
-- the dashboard, never here. Safe to run twice.

update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('app_role', r.role)
from (values
  ('manager@chromies.example.com', 'manager'),
  ('scorer@chromies.example.com',  'scorer'),
  ('viewer@chromies.example.com',  'viewer')
) as r(email, role)
where u.email = r.email;

-- Check: three rows, each with a role, each confirmed.
select
  email,
  raw_app_meta_data ->> 'app_role' as app_role,
  email_confirmed_at is not null   as confirmed
from auth.users
order by email;
