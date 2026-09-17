-- The Chromies Scorebook — schema, row level security and passcode verification.
-- Run this once against a fresh Supabase project (SQL editor, or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Non-secret team settings. Anyone signed in may read these.
create table if not exists team_settings (
  id              int primary key default 1 check (id = 1),
  time_limit_mins int  not null default 60,
  theme           text not null default 'light' check (theme in ('light', 'dark'))
);

-- The three passcode hashes, kept apart from the settings on purpose.
--
-- The handoff sketched these as columns on team_settings with a read policy for
-- every signed-in role, which would let a viewer select the manager hash and
-- attack it offline. They live in their own table instead: RLS is on and there
-- are deliberately NO policies, so the table is unreachable with the anon key no
-- matter what claims a token carries. Only the service_role key — which never
-- leaves the login edge function — can read it.
create table if not exists team_auth (
  id           int primary key default 1 check (id = 1),
  manager_hash text not null,
  scorer_hash  text not null,
  viewer_hash  text not null
);

create table if not exists roster (
  id         text primary key,
  num        text,
  name       text    not null,
  pos        text    not null default 'UT',
  bat        boolean not null default false,
  sort_order int     not null default 0
);

create table if not exists opp_lineup (
  id        int   primary key default 1 check (id = 1),
  team_name text  not null default '',
  batters   jsonb not null default '[]'
);

-- One row per game. `doc` is the whole game object the client works with, minus
-- the undo stack. Every stat in the app is derived from doc->'log', so there are
-- deliberately no stat columns; the generated columns exist only for filtering.
create table if not exists games (
  id         text primary key,
  doc        jsonb not null,
  status     text        generated always as (doc ->> 'status') stored,
  date       bigint      generated always as ((doc ->> 'date')::bigint) stored,
  sample     boolean     generated always as (coalesce((doc ->> 'sample')::boolean, false)) stored,
  updated_at timestamptz not null default now()
);

create index if not exists games_date_idx on games (date desc);
create index if not exists games_status_idx on games (status);
create index if not exists roster_sort_idx on roster (sort_order);

insert into team_settings (id) values (1) on conflict (id) do nothing;
insert into opp_lineup (id) values (1) on conflict (id) do nothing;

alter table team_settings enable row level security;
alter table team_auth     enable row level security;
alter table roster        enable row level security;
alter table opp_lineup    enable row level security;
alter table games         enable row level security;

-- ---------------------------------------------------------------------------
-- Role claim
-- ---------------------------------------------------------------------------

-- The login function mints a JWT carrying `app_role`. Everything below reads it.
create or replace function app_role() returns text
  language sql stable
  as $$ select coalesce(auth.jwt() ->> 'app_role', 'anon') $$;

create or replace function is_signed_in() returns boolean
  language sql stable
  as $$ select app_role() in ('viewer', 'scorer', 'manager') $$;

create or replace function can_score() returns boolean
  language sql stable
  as $$ select app_role() in ('scorer', 'manager') $$;

create or replace function is_manager() returns boolean
  language sql stable
  as $$ select app_role() = 'manager' $$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Read: everyone signed in sees the whole scorebook.
drop policy if exists read_settings on team_settings;
create policy read_settings on team_settings for select using (is_signed_in());

drop policy if exists read_roster on roster;
create policy read_roster on roster for select using (is_signed_in());

drop policy if exists read_opp on opp_lineup;
create policy read_opp on opp_lineup for select using (is_signed_in());

drop policy if exists read_games on games;
create policy read_games on games for select using (is_signed_in());

-- Scorer: may create and update games, but only while a game is in progress, and
-- may never delete one. Separate policies per command — a single FOR ALL policy
-- would hand DELETE to scorers as well.
drop policy if exists scorer_insert_games on games;
create policy scorer_insert_games on games for insert
  with check (is_manager() or (can_score() and doc ->> 'status' = 'in_progress'));

drop policy if exists scorer_update_games on games;
create policy scorer_update_games on games for update
  using (is_manager() or (can_score() and status = 'in_progress'))
  with check (is_manager() or can_score());

drop policy if exists manager_delete_games on games;
create policy manager_delete_games on games for delete using (is_manager());

-- Scorer: may set up the next opponent's lineup.
drop policy if exists scorer_write_opp on opp_lineup;
create policy scorer_write_opp on opp_lineup for update using (can_score()) with check (can_score());

-- Manager: the roster and the team settings.
drop policy if exists manager_write_roster on roster;
create policy manager_write_roster on roster for all using (is_manager()) with check (is_manager());

drop policy if exists manager_write_settings on team_settings;
create policy manager_write_settings on team_settings for update
  using (is_manager()) with check (is_manager());

-- team_auth intentionally has no policies. Do not add one.

-- ---------------------------------------------------------------------------
-- Passcode verification
-- ---------------------------------------------------------------------------

-- Runs the bcrypt comparison inside Postgres so the hashes never leave the
-- database and the edge function needs no crypto library of its own. SECURITY
-- DEFINER because the caller cannot read team_auth; execute is granted to the
-- service_role only, which is the login function's key.
create or replace function verify_passcode(passcode text) returns text
  language plpgsql
  security definer
  set search_path = public, extensions
  as $$
declare
  a team_auth%rowtype;
begin
  select * into a from team_auth where id = 1;
  if not found then return null; end if;
  if a.manager_hash = crypt(passcode, a.manager_hash) then return 'manager'; end if;
  if a.scorer_hash  = crypt(passcode, a.scorer_hash)  then return 'scorer';  end if;
  if a.viewer_hash  = crypt(passcode, a.viewer_hash)  then return 'viewer';  end if;
  return null;
end;
$$;

revoke all on function verify_passcode(text) from public, anon, authenticated;
grant execute on function verify_passcode(text) to service_role;

-- ---------------------------------------------------------------------------
-- Set the three passcodes
-- ---------------------------------------------------------------------------
-- Run this in the Supabase SQL editor, NOT here.
--
-- This repository is public, so anything committed to it is world-readable.
-- Paste the block below into the SQL editor, fill in the three passcodes there,
-- and run it. Never save your real passcodes back into this file. (Only the
-- bcrypt hashes are stored, and they never leave the database.)
--
-- Re-run the same block any time to rotate a passcode.
--
-- insert into team_auth (id, manager_hash, scorer_hash, viewer_hash)
-- values (
--   1,
--   crypt('CHANGE-ME-manager', gen_salt('bf', 10)),
--   crypt('CHANGE-ME-scorer',  gen_salt('bf', 10)),
--   crypt('CHANGE-ME-viewer',  gen_salt('bf', 10))
-- )
-- on conflict (id) do update set
--   manager_hash = excluded.manager_hash,
--   scorer_hash  = excluded.scorer_hash,
--   viewer_hash  = excluded.viewer_hash;
