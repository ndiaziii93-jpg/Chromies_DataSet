-- OPTIONAL. Only once passcode sign-in is working through Supabase Auth.
--
-- team_auth and verify_passcode belonged to the edge-function design, which
-- cannot work on a project that signs with asymmetric keys. Nothing reads them
-- any more, and team_auth holds a second copy of each passcode as a bcrypt
-- hash — a secret kept for no reason is still a secret to look after.
--
-- Drop them only after you have signed in as all three roles successfully.

drop function if exists verify_passcode(text);
drop table if exists team_auth;
