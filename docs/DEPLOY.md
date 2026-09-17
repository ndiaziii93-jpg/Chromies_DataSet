# Deploying

The app is a static site. Any free static host works; both options below are free
with no time limit at this scale.

## GitHub Pages (what this repo is set up for)

**The repository has to be public.** GitHub Pages is free only for public repos;
on a private one it asks you to upgrade. That is why this repo is public.

Public means the *source code* is readable by anyone — it does not mean the app is
unprotected, and it does not change who can reach the site. A deployed Pages site is
publicly reachable either way. What guards the scorebook is the passcode gate and the
row level security behind it: without a passcode the app shows a sign-in screen and
the database returns nothing. There are no secrets in the code (`.env` is gitignored,
and the Supabase anon key is designed to ship to browsers and grants nothing on its
own).

The one rule that follows from being public: **never commit a real passcode.** Set
them in the Supabase SQL editor, as `supabase/migrations/0001_init.sql` explains.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. If you are using Supabase, add two repository *variables* under
   **Settings → Secrets and variables → Actions → Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   Variables rather than secrets on purpose: both values are public by design (the
   anon key is meant to ship to browsers, and every table is behind row level
   security), and keeping them readable means you can confirm what was built. Leave
   them unset and the site builds in local-only mode.
3. Push to `main`. `.github/workflows/deploy.yml` typechecks, builds and publishes.

The site lands at `https://<user>.github.io/Chromies_DataSet/`, which is why the Vite
`base` defaults to `/Chromies_DataSet/`.

## Cloudflare Pages

Unlimited bandwidth on the free plan and easier custom domains.

- **Build command:** `BASE_PATH=/ npm run build`
- **Output directory:** `dist`
- **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

`BASE_PATH=/` matters — Cloudflare serves from the root, and building with the Pages
default would look for assets under `/Chromies_DataSet/`.

For a custom domain, use `BASE_PATH=/` there too.

## After the first deploy

- Open the URL and sign in with the viewer passcode. You should see Today, Games,
  Players and Trends, read-only, with no Manage tab.
- Sign in as manager and confirm Live scoring and Manage appear.
- On a phone, use **Add to Home Screen**. The service worker precaches the shell and
  the fonts, so the app opens with no signal.
- If you changed `ALLOWED_ORIGIN` on the edge function, make sure it matches the
  deployed origin exactly — scheme and host, no trailing slash, no path.

## Sharing it with the team

Send the URL and the **viewer** passcode. Keep the manager and scorer passcodes on a
channel the whole league isn't in.

## Costs

Nothing recurring at this scale. GitHub Pages and Cloudflare Pages are free for
static sites; the Supabase free tier covers 500 MB of Postgres and 50k monthly active
users against a database that will hold a few MB of game logs. The one thing to know
is that a free Supabase project pauses after 7 days with no traffic and resumes on
the next request — a weekly ping from a free scheduler avoids the few-second wait.
