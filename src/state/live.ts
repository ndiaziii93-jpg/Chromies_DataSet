import * as E from '../engine/scoring.js';
import type { Game } from '../lib/types';
import { useScorebook } from './store';

/** The in-progress game, if there is one. `activeId` is cleared when it ends. */
export function useActiveGame(): Game | null {
  const { data } = useScorebook();
  return data.games.find((g) => g.id === data.activeId) ?? null;
}

/** The scoreboard fragment the top bar and the Today card both show. */
export function liveHeadline(g: Game): { us: number; them: number; inning: string } {
  return {
    us: g.score.us,
    them: g.score.them,
    inning:
      g.status !== 'in_progress'
        ? 'FINAL'
        : `${g.half === 'top' ? '▲' : '▼'} ${E.ordinal(g.inning).toUpperCase()}`,
  };
}
