import { css, cssx } from '../lib/css';
import type { Game } from '../lib/types';
import { useNav } from '../state/nav';
import { useScorebook } from '../state/store';

export const innings = (g: Game): number => g.log.reduce((a, l) => Math.max(a, l.inning || 0), 1);
export const wl = (g: Game): 'W' | 'L' | 'T' =>
  g.score.us > g.score.them ? 'W' : g.score.us < g.score.them ? 'L' : 'T';

/** One finished game in a list. Opens the recap. */
export function ResultRow({ game, showInnings }: { game: Game; showInnings?: boolean }) {
  const { fmtDate } = useScorebook();
  const nav = useNav();
  const letter = wl(game);

  return (
    <button
      type="button"
      onClick={() => nav.openGame(game.id)}
      style={css(
        'background:var(--card);border:0;border-radius:6px;padding:14px 16px;display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:12px;text-align:left',
      )}
    >
      <span
        style={cssx("font:700 22px 'IBM Plex Mono',monospace", {
          color: letter === 'W' ? 'var(--ink)' : 'var(--muted3)',
        })}
      >
        {letter}
      </span>
      <span style={css('display:flex;flex-direction:column')}>
        <span style={css('font-weight:600;font-size:15px')}>{game.opp}</span>
        <span style={css("font:500 12px 'IBM Plex Mono',monospace;color:var(--muted2)")}>
          {fmtDate(game.date)}
          {showInnings ? ` · ${innings(game)} inn` : ''}
        </span>
      </span>
      <span
        style={css("font:700 20px 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums")}
      >
        {game.score.us}–{game.score.them}
      </span>
    </button>
  );
}
