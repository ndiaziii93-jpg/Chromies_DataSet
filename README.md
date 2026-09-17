# The Chromies Scorebook

A slowpitch softball scorebook for one team. Managers score games live on a phone or
tablet by tapping an outcome and then tapping where the ball landed on a realistic
diamond; the app infers the fielder and contact type, advances runners, and derives
every stat — batting, fielding, spray charts, trends and the rule-based commentator
write-ups — from the play log. **Nothing derived is stored.**

This is the production rebuild of the design-handoff prototype: React + Vite +
TypeScript, deployed as a static site, with an optional Supabase backend for
multi-user access.

```bash
npm install
npm run dev        # http://localhost:5173/Chromies_DataSet/
npm run build      # typecheck + production build into dist/
npm run preview    # serve the built site
```

## How it fits together

```
src/
  engine/        scoring.js · stats.js · analysis.js  ← kept verbatim from the handoff
                 (+ .d.ts type declarations, which describe them without touching them)
  lib/           types, the CSS helper, the shared range filter
  state/         the scorebook document, theme, roles, sync, navigation
  components/    wordmark, the diamond, binder tabs, shared chrome
  screens/       Today · Live · Games · Players · Trends · Manage · SignIn
supabase/        migration SQL and the passcode login edge function
docs/            SUPABASE_SETUP.md, DEPLOY.md, and the reference screenshots
```

**The three engine modules are the product and are byte-for-byte as delivered.**
They are plain ES modules with no framework dependency; `allowJs` lets TypeScript
import them directly, and the `.d.ts` files alongside describe their shapes without
modifying them. Every number in the UI comes from `stats.js`/`analysis.js` reading
`games[].log` — there are no stat columns anywhere, in the client or the database.

### Styling

The handoff is a single HTML prototype where every element carries an inline
`style="..."`, and the brief was to recreate it pixel-faithfully. Rather than
hand-transcribing several hundred declarations into camelCase object literals, the
`css()` helper in `src/lib/css.ts` parses the literal CSS string into a React style
object and caches it. Each element can be diffed against the prototype line for
line, and the shorthands the design leans on (`font:600 11px 'IBM Plex Mono',monospace`)
survive unchanged.

## Roles

Sign-in is by **team passcode** — no accounts, no email. Three passcodes map to three
roles, and the client hides exactly what the database would refuse:

| | Read everything | Score a live game | Bad Guys lineup | Roster, settings, data | Delete a game |
|---|---|---|---|---|---|
| **manager** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **scorer** | ✓ | ✓ | ✓ | | |
| **viewer** | ✓ | | | | |

Viewers see Live read-only (scorebug, diamond and lineup, no keypad) and do not see
the Manage tab at all.

**With no Supabase project configured the app runs exactly as the prototype did**:
one device, localStorage, full rights, no sign-in screen. Setting `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` turns on the passcode gate and server sync with no code
change. See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Offline

Scoring happens at a field that often has no signal, so the app is built local-first:

- Every change is written to localStorage immediately; that is the working copy.
- A service worker precaches the shell and the fonts, so the app **opens** offline —
  not just keeps working in an already-open tab. It is installable to a home screen.
- Row writes are queued (in localStorage, so they survive a reload) and flushed when
  the network returns. Ops collapse per target, so a whole game scored offline costs
  one upsert on reconnect rather than one per play.
- Conflict rule: one scorer per game, last write wins per `games.id`.

The fonts are self-hosted in `public/fonts/` rather than loaded from Google Fonts, so
first load at the field doesn't depend on a third-party CDN.

The undo stack is per-session: it covers the whole game while the tab is open, but a
reload clears it. It is deliberately not persisted — each snapshot holds a full copy
of the game, and a long game's stack would crowd the scorebook out of a 5 MB
localStorage budget.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to
`main`. Enable **Settings → Pages → Source: GitHub Actions** once, and set the two
repository *variables* (not secrets — both values are public by design) if you are
using Supabase. Full walkthrough, including Cloudflare Pages: [docs/DEPLOY.md](docs/DEPLOY.md).

The Vite `base` defaults to `/Chromies_DataSet/` for Pages. Build with `BASE_PATH=/`
for a root-served host or a custom domain.

## Notes on fidelity

Checked against `docs/screenshots/` at desktop width, in both themes.

- **The fan clip and the vignette are Live-only.** In the prototype the `fan` clipPath
  and `vig` gradient are defined inside the Live screen's own SVG, so on every other
  tab the references go unresolved and those fields render as a full rectangle of
  grass with the foul lines running out to the bottom corners. The reference
  screenshots show exactly that, so the recap, player, trends and position-picker
  fields are unclipped and unvignetted here too, and only Live carries the defs.
- **The live line score has no per-cell highlight.** `lineScore()` returns a `cur`
  flag per cell and the prototype binds `color:{{ c.fg }}`, but nothing ever sets
  `fg` — so the cells render plain white, which is what the screenshots show.
- **Numbers differ from the screenshots.** The reference captures were taken against
  the designer's real 19-player roster; a fresh install seeds the built-in 12-player
  demo roster. The sample season is deterministic (seeded, and independent of the
  date), so the same roster always produces the same games.
- The clock is the "remaining" variant, keypad keys are 56px and outcome labels are
  on — the prototype's defaults. Those were design-component knobs with no UI in the
  screenshots, so they are not exposed as settings.

## Deliberate changes to the handoff

Two places where following the handoff literally would have shipped a defect:

1. **Passcode hashes are in their own table.** The handoff put `manager_hash`,
   `scorer_hash` and `viewer_hash` on `team_settings` and gave every signed-in role
   `SELECT` on it, which would let any viewer read the manager hash and attack it
   offline. They now live in `team_auth`, which has RLS on and **no policies**, so it
   is unreachable with the anon key; only the service_role key inside the login
   function can read it, and the bcrypt comparison runs inside Postgres via a
   `SECURITY DEFINER` function so the hashes never leave the database.
2. **Per-command policies on `games`.** The handoff's single `FOR ALL` policy would
   have let a scorer delete games. Insert/update are scoped to scorers (and only
   while `status = 'in_progress'`); delete is manager-only.

The login edge function also handles CORS preflight — without it the browser call
fails — and rate-limits attempts per IP, since a short passcode on a public endpoint
is worth making expensive to guess.
