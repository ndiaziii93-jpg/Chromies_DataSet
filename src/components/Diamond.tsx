import { css, cssx } from '../lib/css';

/**
 * The diamond, at two sizes.
 *
 * `Diamond` is the live one: it shows which bases are occupied and, where the
 * roster gives them, the jersey number of the runner standing there. Paper has
 * to draw a dead diamond per plate appearance because it cannot update; a
 * screen can draw one that is always true, so this is the only one on a scoring
 * screen and it is large enough to read at arm's length.
 *
 * `Mark` is the small one — a season of plate appearances, a run of results —
 * where the shape carries identity and the fill carries the fact.
 */

/** Base centres in the 118-square viewBox: home, first, second, third. */
const AT = [
  { x: 59, y: 100 },
  { x: 100, y: 59 },
  { x: 59, y: 18 },
  { x: 18, y: 59 },
];
const SIDE = 19;

export interface DiamondProps {
  /** Engine order: first, second, third. */
  bases: (string | null)[];
  /** Jersey number for a runner, blank when the roster has none. */
  numFor?: (id: string) => string;
  size?: number;
  /** Draw the ring-out at home: a run has just scored. */
  scored?: boolean;
  /** Drawn on the dark strip rather than a card. */
  onStrip?: boolean;
}

export function Diamond({ bases, numFor, size = 124, scored = false, onStrip = true }: DiamondProps) {
  const occupied = [null, bases[0] ?? null, bases[1] ?? null, bases[2] ?? null];

  const full = onStrip ? 'var(--accent)' : 'var(--data-a)';
  const empty = onStrip ? '#1C1C1A' : 'var(--card2)';
  const edge = onStrip ? '#6E6E68' : 'var(--line)';
  const path = onStrip ? '#3A3A36' : 'var(--line)';
  const numInk = onStrip ? '#111111' : 'var(--on-accent)';

  const occupiedNames = occupied
    .map((id, i) => (i && id ? ['first', 'second', 'third'][i - 1] : null))
    .filter(Boolean);
  const label =
    scored ? 'A run scores.'
    : occupiedNames.length ? `Runners on ${occupiedNames.join(' and ')}.`
    : 'Bases empty.';

  return (
    <svg
      viewBox="0 0 118 118"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      style={css('flex-shrink:0;display:block')}
    >
      <path d="M59 100 L100 59 L59 18 L18 59 Z" fill="none" stroke={path} strokeWidth="2" />

      {scored && (
        <g>
          <circle cx="59" cy="100" r="15" fill="none" stroke={full} strokeWidth="2" opacity=".55" />
          <circle cx="59" cy="100" r="23" fill="none" stroke={full} strokeWidth="1.5" opacity=".26" />
          <circle cx="59" cy="100" r="31" fill="none" stroke={full} strokeWidth="1" opacity=".12" />
        </g>
      )}

      {AT.map((b, i) => {
        const on = i === 0 ? scored : Boolean(occupied[i]);
        return (
          <rect
            key={i}
            x={b.x - SIDE / 2}
            y={b.y - SIDE / 2}
            width={SIDE}
            height={SIDE}
            rx="2"
            transform={`rotate(45 ${b.x} ${b.y})`}
            fill={on ? full : empty}
            stroke={on ? 'none' : edge}
            strokeWidth={on ? undefined : 1.5}
          />
        );
      })}

      {AT.map((b, i) => {
        const id = occupied[i];
        // pnum() hands back '#33'; the hash does not fit and does not help.
        const num = i && id && numFor ? numFor(id).replace(/^#/, '').trim().slice(0, 2) : '';
        if (!num) return null;
        return (
          <text
            key={'n' + i}
            x={b.x}
            y={b.y}
            textAnchor="middle"
            dominantBaseline="central"
            style={cssx("font:700 10px 'IBM Plex Mono',monospace", { fill: numInk })}
          >
            {num}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * Scored, reached-and-stranded, out — and the same shape doing duty as a win or
 * a loss in a run of results. Amber is a brand colour, not a data colour: on a
 * light card it measures 1.56:1 against the surface, so the marks use the
 * validated chart step instead.
 */
export type MarkKind = 'scored' | 'reached' | 'out' | 'win' | 'loss' | 'empty';

const MARK_LABEL: Record<MarkKind, string> = {
  scored: 'Scored',
  reached: 'Reached base',
  out: 'Out',
  win: 'Won',
  loss: 'Lost',
  empty: 'Not batted',
};

export function Mark({ kind, size = 13, title }: { kind: MarkKind; size?: number; title?: string }) {
  const fill =
    kind === 'scored' || kind === 'win' ? 'var(--data-a)'
    : kind === 'out' ? 'var(--line)'
    : 'transparent';
  const border =
    kind === 'reached' ? '1.5px solid var(--ink)'
    : kind === 'loss' ? '1.5px solid var(--data-b)'
    : kind === 'empty' ? '1.5px dashed var(--line)'
    : '0';

  return (
    <span
      role="img"
      aria-label={title ?? MARK_LABEL[kind]}
      title={title ?? MARK_LABEL[kind]}
      style={cssx('display:inline-block;transform:rotate(45deg);border-radius:2px;box-sizing:border-box', {
        width: size,
        height: size,
        background: fill,
        border,
      })}
    />
  );
}

/** The legend that makes the marks readable without relying on colour alone. */
export function MarkLegend({ kinds }: { kinds: MarkKind[] }) {
  return (
    <span style={css('display:flex;align-items:center;gap:14px;flex-wrap:wrap')}>
      {kinds.map((k) => (
        <span key={k} style={css('display:flex;align-items:center;gap:6px')}>
          <Mark kind={k} size={11} />
          <span style={css('font:400 11px/1.2 "IBM Plex Sans",sans-serif;color:var(--muted)')}>
            {MARK_LABEL[k]}
          </span>
        </span>
      ))}
    </span>
  );
}
