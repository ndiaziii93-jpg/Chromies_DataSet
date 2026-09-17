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

## 3. Set the three passcodes

The last block of that file is commented out. Uncomment it, replace the three
strings, and run just that block:

```sql
insert into team_auth (id, manager_hash, scorer_hash, viewer_hash)
values (
  1,
  crypt('your-manager-passcode', gen_salt('bf', 10)),
  crypt('your-scorer-passcode',  gen_salt('bf', 10)),
  crypt('your-viewer-passcode',  gen_salt('bf', 10))
)
on conflict (id) do update set
  manager_hash = excluded.manager_hash,
  scorer_hash  = excluded.scorer_hash,
  viewer_hash  = excluded.viewer_hash;
```

Only the bcrypt hashes are stored. Re-run the same block any time to rotate a
passcode — existing tokens stay valid until they expire (30 days), so rotate and
then tell people to sign out if you need someone locked out sooner.

Pick passcodes people can type on a phone at a field, but make them long enough to
be worth having: three or four unrelated words beats a short cryptic string.

## 4. Deploy the login function

The function trades a passcode for a signed JWT carrying `app_role`. It has no
imports — nothing to install, nothing to pin — so the browser editor is the easiest
route and no CLI is required.

**In the dashboard:** Edge Functions → **Deploy a new function** → name it exactly
`login`. Replace the sample code with the contents of
[`supabase/functions/login/index.ts`](../supabase/functions/login/index.ts) and deploy.

Then turn off JWT verification for this one function: Edge Functions → `login` →
Settings → **Enforce JWT verification: off**. That is correct here — this is the
endpoint people call *before* they have a token, and everything it can do is bounded
by the checks inside it.

Now add the secret it needs: Edge Functions → **Secrets** (or Project Settings →
Edge Functions → Secrets):

| Name | Value |
|---|---|
| `JWT_SECRET` | Project Settings → API → JWT Settings → **JWT Secret** (the legacy HS256 one) |
| `ALLOWED_ORIGIN` | Your site's origin, e.g. `https://you.github.io` — scheme and host only, no path, no trailing slash. Optional; defaults to `*`. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform — do not
set them yourself, and never copy the service_role key anywhere else.

> If Project Settings → API shows only asymmetric **JWT signing keys** (ECC/RSA) and
> no legacy HS256 secret, stop here and say so — the token has to be signed with
> whatever your project verifies, and the function would need a different algorithm.

**With the CLI instead**, if you prefer:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set JWT_SECRET='<the project JWT secret>'
supabase secrets set ALLOWED_ORIGIN='https://<you>.github.io'
supabase functions deploy login --no-verify-jwt
```

Either way, check it:

```bash
curl -s -X POST "https://<ref>.supabase.co/functions/v1/login" \
  -H 'Content-Type: application/json' \
  -d '{"passcode":"your-viewer-passcode"}'
# => {"token":"eyJ...","role":"viewer"}
```

A wrong passcode should give `{"error":"Invalid passcode."}` and a 401.

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

**Auth.** No Supabase user accounts and no email. `login` checks the passcode against
three bcrypt hashes and mints a JWT with `role: authenticated` (which PostgREST
requires) and `app_role: manager | scorer | viewer` (which the policies read). The
client stores that token and sends it as a bearer header on every request.

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

**Sign-in says it can't reach the server.** Almost always CORS. Check
`ALLOWED_ORIGIN` matches the site's origin exactly — scheme and host, no trailing
slash and no path. `https://you.github.io`, not `https://you.github.io/Chromies_DataSet/`.

**Sign-in works, but the app shows no data.** The token is fine and RLS is rejecting
reads, which means the `app_role` claim isn't arriving. Paste the token into
[jwt.io](https://jwt.io) and confirm it carries both `role: "authenticated"` and
`app_role`. If `role` is missing, PostgREST rejects the token outright.

**Writes silently do nothing.** The top bar shows `SYNC RETRYING` when a push is
failing; hover it for the error. A scorer trying to change a finished game is the
expected case — that's the RLS policy doing its job.

**The status never leaves `QUEUED`.** The queue only flushes when the browser reports
itself online *and* a client exists. Reload; the queue is persisted and retries.
