# Supabase setup

Turns the local-first scorebook into the multi-user app: three passcodes, three
roles, one shared season. Everything here fits inside the free tier at ~25 users and
has no time limit.

Until you do this, the app still works — one device, localStorage, full rights, no
sign-in screen. Nothing below changes any application code.

---

## 1. Create the project

1. Create a free project at [supabase.com](https://supabase.com).
2. **Settings → API** — note the **Project URL** and the **anon public** key.

Both of those are safe to put in a public build: the anon key is designed to be
shipped to browsers, and every table is behind row level security.

> Never put the **service_role** key in the front end or in this repo. It bypasses
> RLS entirely. It belongs only in the edge function's secrets.

Free projects pause after 7 days with no traffic and resume on the next request (a
few seconds). A weekly ping from a free scheduler such as cron-job.org keeps it warm
if you'd rather not wait.

## 2. Create the schema

Open **SQL Editor**, paste all of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
and run it. That creates the tables, the row level security policies, and the
`verify_passcode()` function.

## 3. Create the three accounts

> **Why accounts and not an edge function.** The original design minted its own
> JWT in a `login` function. That only works where a project signs tokens with
> the legacy HS256 shared secret. This project signs with an **EC (P-256)** key
> whose private half Supabase holds and never exposes, so a token we signed
> ourselves would never verify — the approach is closed off, not merely harder.
> Supabase Auth issues the token instead, correctly signed whatever the
> algorithm, and the role travels in `app_metadata` where the policies read it.
> Nobody types an email; the sign-in screen is unchanged.

**Authentication → Sign In / Providers → Email**

- Turn **Confirm email** OFF. There is no inbox behind these addresses.
- Turn **Allow new users to sign up** OFF. Three accounts is the whole list.

**Authentication → Users → Add user → Create new user**, three times. Tick
**Auto Confirm User** each time.

| Email | Password |
|---|---|
| `manager@chromies.example.com` | your manager passcode |
| `scorer@chromies.example.com` | your scorer passcode |
| `viewer@chromies.example.com` | your viewer passcode |

The addresses must match exactly — they are the `ACCOUNTS` list in
`src/state/supabase.ts`. `example.com` is reserved by RFC 2606 and cannot
receive mail, which is the point: these are password records, not mailboxes.

Pick passcodes people can type on a phone at a field, but long enough to be
worth having: three or four unrelated words beats a short cryptic string. They
must differ from each other.

## 4. Stamp the roles

Paste [`supabase/auth_roles.sql`](../supabase/auth_roles.sql) into the SQL
editor and run it. It writes `app_role` into each account's `app_metadata`.

Order matters: `app_metadata` is copied into the access token **when the token
is issued**, so run this before anyone signs in. If someone already has a
session, they sign out and back in to pick the role up.

The check at the end should print three rows, each with a role and each
confirmed. An account with a blank role will be refused at sign-in with a
message saying so, rather than appearing to work and then failing every read.

There is **no edge function, no `JWT_SECRET` and no `ALLOWED_ORIGIN`** in this
design. Supabase's own endpoints already send the right CORS headers, and
rate-limiting on failed sign-ins is theirs rather than hand-rolled.

## 5. Point the app at it

Locally, copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

For the deployed site, set the same two as repository **variables** (Settings →
Secrets and variables → Actions → Variables). They are not secrets; variables keep
them readable so you can confirm what was built.

Restart the dev server. The app now opens on the passcode screen.

## 6. Seed the first season

Sign in as manager and either set up the roster by hand under **Manage → Chromies**,
or use **Manage → Data → Import JSON** with an export from a device that already has
the season. The first save pushes everything up.

---

## How the pieces fit

**Auth.** Three Supabase Auth accounts, one per role, whose passwords are the three
passcodes. Nobody types an email: the sign-in screen takes a passcode and the client
tries each account in turn, highest role first. Supabase issues the access token,
signed with the project's own key, carrying `app_role` in `app_metadata`; the client
holds that session and refreshes it in the background, which matters because a game
runs longer than an access token lives.

**Where the hashes live.** In `team_auth`, which has RLS enabled and deliberately no
policies — so it is unreachable with the anon key regardless of what a token claims.
Only the service_role key inside the edge function can read it, and even then the
bcrypt comparison runs inside Postgres through `verify_passcode()`, so the hashes
never travel.

This differs from the original handoff, which put the hashes on `team_settings` and
granted every signed-in role `SELECT` on that table — which would have let any viewer
read the manager hash and attack it offline. See the table below for the rest.

**What each role can do.**

| Table | viewer | scorer | manager |
|---|---|---|---|
| `team_settings` | read | read | read + write |
| `team_auth` | — | — | — (service_role only) |
| `roster` | read | read | read + write |
| `opp_lineup` | read | read + write | read + write |
| `games` | read | read, insert/update while `in_progress` | everything, including delete |

**Sync.** On load the client pulls `roster`, `opp_lineup`, `team_settings` and
`games (id, doc)` and folds them onto the local document. On every save it diffs
against what it last pushed and queues only the changed rows, debounced 500 ms. The
queue lives in localStorage, so it survives a reload, and flushes on `online`. Ops
collapse per target: a whole game scored offline is one upsert on reconnect, not one
per play.

**Conflicts.** One scorer per game, last write wins per `games.id`. Live sync during
a game is not a goal — viewers seeing the result after "End game" is the requirement.

## Troubleshooting

**"That account has no role set."** The password matched but `app_metadata` is
empty, so the policies would refuse everything. Run step 4, then sign out and
back in — the role is baked into the token at issue time.

**"That passcode doesn't match."** All three accounts refused it. Check the
passcode, and check the three addresses in Authentication → Users match the
table in step 3 character for character.

**Sign-in works, but the app shows no data.** The token is fine and RLS is
rejecting reads, which means `app_role` is not arriving. Paste the token into
[jwt.io](https://jwt.io) and confirm it carries `app_metadata.app_role`. If it
does, confirm `0003_role_claim_either_shape.sql` has been run — without it
`app_role()` only looks at a top-level claim, which Supabase Auth does not set.

**Writes silently do nothing.** The top bar shows `SYNC RETRYING` when a push is
failing; hover it for the error. A scorer trying to change a finished game is the
expected case — that is the RLS policy doing its job.

**The status never leaves `QUEUED`.** The queue only flushes when the browser
reports itself online *and* a client exists. Reload; the queue is persisted and
retries.

**Signed out unexpectedly after a long gap.** The refresh token eventually
expires. Sign in again; nothing is lost, because the local cache is the working
copy and syncs up on reconnect.
