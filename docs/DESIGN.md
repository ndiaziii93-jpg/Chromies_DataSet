# The diamond design

Two looks ship. **Diamond** is the default; **classic** is the original
prototype styling, kept whole. Both read the same document, so switching is
free and loses nothing — **Manage → Look**.

The switch exists because this app is used outdoors, one-handed, by someone who
is usually also playing. If the new look turns out to be wrong at a field, the
fix should take one tap and not wait for a deploy.

---

## The idea

A paper scorebook draws a diamond per plate appearance — forty to a page —
because paper cannot update. Every one of those diamonds is a dead snapshot.

A screen has no such limit, so **one live diamond beats forty dead ones**. The
scoring screen carries a single large diamond that is always true: it shows
which bases are occupied and the jersey number of the runner standing on each,
and it fills and rings out at home the moment a run scores. Nobody has to parse
notation to answer "who's on?".

Freed from recording duty, the same shape becomes the unit of a season.
`Mark` renders it small: one per trip to the plate on a player's card, one per
game in a run of results. A player's year reads as texture — hot weekends,
quiet ones — in the shape of the sport.

Nowhere in the app is there a scorebook *grid*. A 390px screen is the worst
possible surface for one, and if the best idea the digital version has is
"it looks like the paper", there is no reason to stop using the paper.

## Colour, and the thing that caught us out

**Brand amber `#FFC400` is not a data colour.** On the light ground it measures
**1.45:1**, and on a white card **1.60:1**, where the floor for a graphic is
3:1. The charts had been drawing their marks in it, which meant the
runs-by-inning bars and the rolling-average dots were close to invisible in
daylight — exactly the condition this app is used in.

So the palette splits by job:

| Token | Light | Dark | Job |
|---|---|---|---|
| `--accent` | `#FFC400` | `#FFC400` | Brand. Only on the near-black strip, where it is 9.85:1. |
| `--data-a` | `#B5790A` | `#C08818` | First chart series, and the filled mark. |
| `--data-b` | `#30619F` | `#5391D6` | Second chart series, and selection outlines. |
| `--blue` | `#30619F` | `#7FA8DC` | Section labels and links. |

Both pairs were run through the validator rather than eyeballed, and both clear
the lightness band, the chroma floor, adjacent-pair CVD separation, the
normal-vision floor and 3:1 contrast. **Dark is its own pair**, stepped against
the dark surface — not a flip of the light one, which fails the band.

```
node scripts/validate_palette.js "#B5790A,#30619F" --mode light
node scripts/validate_palette.js "#C08818,#5391D6" --mode dark
```

Two rules fall out of this, and they are easy to break by accident:

- **`--data-a` is a graphic colour, not a text colour.** At 3.34:1 on the ground
  it clears the 3:1 floor for a bar or a dot and fails the 4.5:1 floor for type.
  Amber-coloured text belongs on the strip or nowhere.
- **Marks never carry meaning by colour alone.** Every legend pairs the shape
  with a word, result rows keep the W/L letter beside the mark, and the live
  diamond carries an `aria-label` naming the occupied bases.

## What the pieces are

- `components/Diamond.tsx` — `Diamond` (live bases, jersey numbers, scored
  state), `Mark` (the small one), `MarkLegend`.
- `components/Glance.tsx` — `GlanceBar`, the read-only part of the scoring
  screen, and `RunBanner`, the moment a run lands.
- `lib/marks.ts` — `plateMarks` reads the engine logs back into one mark per
  trip; `groupByWeekend` buckets a season on the gaps between games rather than
  week numbers, because a slowpitch season is played in blocks.

Nothing here stores derived data. Every mark, bar and sentence is computed from
`games[].log` on render, the same as the rest of the app.

## Not done yet

- The drag-to-score gesture from the design review — hold the batter, drag to
  where the ball went — is **not built**. The keypad is still the input. The
  diamond work above stands on its own and the gesture can be layered on later
  behind its own switch, which is the order the review settled on.
- Dark mode has the tokens but has not been reviewed screen by screen.
