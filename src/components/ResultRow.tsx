import { css, cssx } from '../lib/css';
import type { Game } from '../lib/types';
import { useNav } from '../state/nav';
import { useScorebook } from '../state/store';
import { Mark } from './Diamond';

export const innings = (g: Game): number => g.log.reduce((a, l) => Math.max(a, l.inning || 0), 1);
export const wl = (g: Game): 'W' | 'L' | 'T' =>
  g.score.us > g.score.them ? 'W' : g.score.us < g.score.them ? 'L' : 'T';

/** One finished game in a list. Opens the recap. */
export function ResultRow({ game, showInnings }: { game: Game; showInnings?: boolean }) {
  const { fmtDate, design } = useScorebook();
  const nav = useNav();
  const letter = wl(game);

  return (
    <button
      type="button"
      onClick={() => nav.openGame(game.id)}
      style={css(
        'background:var(--card);border:0;border-radius:6px;padding:14px 16px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;text-align:left',
      )}
    >
      {/* The same shape that marks a trip round carries a result here, with
          the letter kept beside it so nothing rests on colour alone. */}
      {design === 'diamond' ? (
        <span style={css('display:flex;align-items:center;gap:8px')}>
          <Mark
            kind={letter === 'W' ? 'win' : 'loss'}
            size={15}
            title={letter === 'W' ? 'Won' : letter === 'L' ? 'Lost' : 'Tied'}
          />
          <span
            style={cssx("font:700 15px 'IBM Plex Mono',monospace", {
              color: letter === 'W' ? 'var(--ink)' : 'var(--muted2)',
            })}
          >
            {letter}
          </span>
        </span>
      ) : (
        <span
          style={cssx("font:700 22px 'IBM Plex Mono',monospace", {
            color: letter === 'W' ? 'var(--ink)' : 'var(--muted3)',
          })}
        >
          {letter}
        </span>
      )}
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
