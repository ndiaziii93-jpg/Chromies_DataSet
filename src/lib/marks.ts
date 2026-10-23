import * as E from '../engine/scoring.js';
import * as S from '../engine/stats.js';
import type { Game, PlayLog } from './types';

/**
 * What became of one trip to the plate. Everything here is read back out of the
 * engine's own logs — nothing is stored, and nothing is inferred that the
 * scorer did not record.
 */
export type PaMark = 'scored' | 'reached' | 'out';

const isPlay = (l: Game['log'][number]): l is PlayLog => !l.manager && !l.scoreOnly;

/**
 * Every plate appearance a player took, oldest first.
 *
 * A trip counts as `scored` when that same runner later crosses the plate in
 * the half-inning it started — which is the thing the filled diamond on paper
 * has always meant. `reached` is on base and stranded; `out` is the rest.
 * A hit batter is a tally, not a trip, so it never produces a mark.
 */
export function plateMarks(games: Game[], playerId: string): PaMark[] {
  const out: PaMark[] = [];

  for (const g of [...games].sort((a, b) => a.date - b.date)) {
    // Index into `out` for each unscored trip still live in this half-inning.
    let live: number[] = [];
    let half = '';

    for (const l of g.log) {
      if (!isPlay(l) || !S.usLog(g, l)) continue;

      const key = l.inning + l.half;
      if (key !== half) {
        half = key;
        live = [];
      }

      // A runner coming home settles whichever of their trips is still live.
      if (l.runs.includes(playerId)) {
        const idx = live.shift();
        if (idx != null) out[idx] = 'scored';
      }

      if (l.batter !== playerId) continue;
      if (E.TALLY_ONLY.has(l.outcome)) continue;

      const scoredOnTheSwing = l.runs.includes(playerId);
      const onBase = (l.basesAfter ?? []).includes(playerId);

      out.push(scoredOnTheSwing ? 'scored' : onBase ? 'reached' : 'out');
      if (!scoredOnTheSwing && onBase) live.push(out.length - 1);
    }
  }

  return out;
}

/** How many of those trips came all the way round. */
export const timesRound = (marks: PaMark[]): number => marks.filter((m) => m === 'scored').length;

export interface Weekend {
  /** 1-based, in the order the season played out. */
  n: number;
  label: string;
  games: Game[];
  won: number;
  lost: number;
  runsFor: number;
  runsAgainst: number;
}

/** Fridayish bucket: games within three days of each other belong together. */
const SAME_WEEKEND = 3.5 * 864e5;

/**
 * The season in weekends. A slowpitch season is played in blocks, not evenly
 * across the calendar, so the grouping follows the gaps between games rather
 * than week numbers — two games eleven days apart are two weekends whatever the
 * calendar says.
 */
export function groupByWeekend(games: Game[]): Weekend[] {
  const finals = games.filter((g) => g.status === 'final').sort((a, b) => a.date - b.date);
  const out: Weekend[] = [];

  for (const g of finals) {
    const last = out[out.length - 1];
    const prev = last?.games[last.games.length - 1];
    const near = prev && g.date - prev.date <= SAME_WEEKEND;

    const bucket =
      near && last
        ? last
        : (out.push({
            n: out.length + 1,
            label: 'Weekend ' + (out.length + 1),
            games: [],
            won: 0,
            lost: 0,
            runsFor: 0,
            runsAgainst: 0,
          }),
          out[out.length - 1]);

    bucket.games.push(g);
    bucket.runsFor += g.score.us;
    bucket.runsAgainst += g.score.them;
    if (g.score.us > g.score.them) bucket.won += 1;
    else if (g.score.us < g.score.them) bucket.lost += 1;
  }

  return out;
}
