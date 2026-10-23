import { css, cssx } from '../lib/css';
import type { Game } from '../lib/types';
import * as E from '../engine/scoring.js';
import { Diamond } from './Diamond';
import { ChromiesLabel } from './Wordmark';

/**
 * The part of the scoring screen nobody taps.
 *
 * Score, inning, outs, and who is standing where — sized to be read at arm's
 * length while you are watching the game rather than the phone. The diamond is
 * the biggest thing on it on purpose: it answers "who is on?" without making
 * anyone parse notation.
 */
export function GlanceBar({
  game,
  oppName,
  numFor,
  scored,
  runs = 1,
  children,
}: {
  game: Game;
  oppName: string;
  numFor: (id: string) => string;
  /** A run landed on the last play: ring out at home. */
  scored: boolean;
  /** How many came round on it. */
  runs?: number;
  /** The line score, which keeps its place underneath. */
  children?: React.ReactNode;
}) {
  const inP = game.status === 'in_progress';
  const half = game.half === 'top' ? '▲' : '▼';
  const inning = !inP ? 'FINAL' : `${half} ${E.ordinal(game.inning).toUpperCase()}`;

  return (
    <div
      style={css(
        'background:var(--strip);color:var(--on-strip);padding:14px 18px 14px;display:flex;flex-direction:column;gap:12px',
      )}
    >
      <div style={css('display:flex;align-items:center;gap:16px;flex-wrap:wrap')}>
        <div style={css('flex-grow:1;min-width:150px;display:flex;flex-direction:column;gap:10px')}>
          <div style={css('display:flex;flex-direction:column;gap:3px')}>
            <div style={css('display:flex;align-items:baseline;gap:10px')}>
              <span
                style={cssx(
                  "font:700 36px/1 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums",
                  { color: scored ? 'var(--accent)' : 'var(--on-strip)' },
                )}
              >
                {game.score.us}
              </span>
              <span style={css("font:600 15px 'IBM Plex Sans',sans-serif")}>
                <ChromiesLabel />
              </span>
              {scored && (
                <span
                  style={css(
                    "font:700 11px 'IBM Plex Mono',monospace;color:var(--on-accent);background:var(--accent);border-radius:3px;padding:2px 5px",
                  )}
                >
                  +{runs}
                </span>
              )}
            </div>
            <div style={css('display:flex;align-items:baseline;gap:10px')}>
              <span
                style={css(
                  "font:700 36px/1 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums",
                )}
              >
                {game.score.them}
              </span>
              <span
                style={css(
                  "font:500 15px 'IBM Plex Sans',sans-serif;color:var(--on-strip-muted)",
                )}
              >
                {oppName}
              </span>
            </div>
          </div>

          <div style={css('display:flex;align-items:center;gap:11px;flex-wrap:wrap')}>
            <span
              style={css(
                "font:700 13px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:var(--accent)",
              )}
            >
              {inning}
            </span>
            <span style={css('display:flex;gap:5px;align-items:center')} aria-label={`${game.outs} out`}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={cssx('width:9px;height:9px;border-radius:50%;box-sizing:border-box', {
                    background: i < game.outs ? 'var(--accent)' : 'transparent',
                    border: i < game.outs ? '0' : '1.5px solid #6B6B66',
                  })}
                />
              ))}
            </span>
            <span
              style={css(
                "font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.1em;color:var(--on-strip-muted)",
              )}
            >
              OUT
            </span>
            {inP && (
              <span
                style={css(
                  "font:600 12px 'IBM Plex Mono',monospace;color:var(--on-strip-muted);margin-left:auto",
                )}
              >
                {E.timeLeft(game)}
              </span>
            )}
          </div>
        </div>

        <Diamond bases={game.bases} numFor={numFor} scored={scored} size={118} />
      </div>

      {children}
    </div>
  );
}

/**
 * The moment a run lands. Says who came round and off what, and keeps undo
 * within reach — the instant you most want it is the instant you have just
 * recorded the wrong thing.
 */
export function RunBanner({
  scorers,
  detail,
  onUndo,
  canUndo,
}: {
  scorers: string;
  detail: string;
  onUndo: () => void;
  canUndo: boolean;
}) {
  return (
    <div
      style={css(
        'margin:12px 20px 0;padding:12px 15px;border-radius:12px;background:var(--accent);color:var(--on-accent);display:flex;align-items:center;gap:12px',
      )}
    >
      <svg viewBox="0 0 22 22" width="19" height="19" aria-hidden="true" style={css('flex-shrink:0')}>
        <rect
          x="4.5"
          y="4.5"
          width="13"
          height="13"
          rx="1.5"
          transform="rotate(45 11 11)"
          fill="currentColor"
        />
      </svg>
      <div style={css('flex-grow:1;display:flex;flex-direction:column;gap:2px;min-width:0')}>
        <span style={css("font:700 15px 'IBM Plex Sans',sans-serif")}>{scorers}</span>
        <span style={css("font:400 13px 'IBM Plex Sans',sans-serif;opacity:.78")}>{detail}</span>
      </div>
      {canUndo && (
        <button
          type="button"
          onClick={onUndo}
          style={css(
            "min-height:44px;min-width:62px;border:0;border-radius:10px;background:rgba(17,17,17,.12);color:var(--on-accent);font:600 14px 'IBM Plex Sans',sans-serif;cursor:pointer",
          )}
        >
          Undo
        </button>
      )}
    </div>
  );
}
