import type { ReactNode } from 'react';
import { css } from '../lib/css';

/**
 * The fan clip and the vignette belong to the live scoring field only. Every other
 * field in the design — the recap and player spray charts, the trends chart, the
 * position picker — shows the full rectangle of grass, foul lines running out to the
 * bottom corners and no darkening. Keeping the defs scoped to the field that uses
 * them is what makes that difference, and it matches the reference screenshots.
 */
function LiveDefs() {
  return (
    <defs>
      <clipPath id="fan">
        <path d="M50 92 L4 46 A65 65 0 0 1 96 46 Z" />
      </clipPath>
      <radialGradient id="vig" cx="50%" cy="85%" r="75%">
        <stop offset="55%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity=".4" />
      </radialGradient>
    </defs>
  );
}

export type Guides = 'none' | 'live' | 'player' | 'trends';

export interface BackdropProps {
  /** 96 everywhere except the square position-picker viewBox, which uses 100. */
  extent?: number;
  /** Live only: clip the grass to the fan of fair territory and add the vignette. */
  clip?: boolean;
  mow?: boolean;
  mound?: boolean;
  rubber?: boolean;
  batterBoxes?: boolean;
  plate?: boolean;
  guides?: Guides;
}

/**
 * Grass, mow stripes, dirt and foul lines — the realistic diamond the taps land on.
 * Every measurement is the prototype's: home plate at (50,92) in a 0–100 square.
 */
export function FieldBackdrop({
  extent = 96,
  clip = false,
  mow = true,
  mound = true,
  rubber = false,
  batterBoxes = false,
  plate = false,
  guides = 'none',
}: BackdropProps) {
  return (
    <>
      {clip && <LiveDefs />}
      <g clipPath={clip ? 'url(#fan)' : undefined}>
        <rect x="0" y="0" width="100" height={extent} fill="#4A8A3E" />
        {mow && (
          <>
            <circle cx="50" cy="92" r="59" fill="none" stroke="#559849" strokeWidth="5" />
            <circle cx="50" cy="92" r="49" fill="none" stroke="#559849" strokeWidth="5" />
            <circle cx="50" cy="92" r="39" fill="none" stroke="#559849" strokeWidth="5" />
          </>
        )}
        <circle cx="50" cy="92" r="64" fill="none" stroke="#A57E52" strokeWidth="4" />
        <circle cx="50" cy="66" r="27" fill="#BD9262" />
        <path d="M50 87 L69 68 L50 49 L31 68 Z" fill="#4A8A3E" />
        <circle cx="50" cy="92" r="8" fill="#BD9262" />
        {mound && <circle cx="50" cy="63" r="3.2" fill="#AA8153" />}
        {rubber && <rect x="49" y="62.5" width="2" height=".8" fill="#fff" />}
        <path d="M50 92 L4 46 M50 92 L96 46" stroke="#fff" strokeWidth=".6" />
        {batterBoxes && (
          <>
            <rect x="45.3" y="89" width="2.6" height="5" fill="none" stroke="#fff" strokeWidth=".4" />
            <rect x="52.1" y="89" width="2.6" height="5" fill="none" stroke="#fff" strokeWidth=".4" />
          </>
        )}
        {guides === 'live' && (
          <g stroke="#fff" strokeOpacity=".22" strokeWidth=".3">
            <path d="M50 92 L50 27" />
            <path d="M50 92 L18 32" />
            <path d="M50 92 L82 32" />
            <circle cx="50" cy="92" r="20" fill="none" />
            <circle cx="50" cy="92" r="35" fill="none" />
            <circle cx="50" cy="92" r="50" fill="none" />
          </g>
        )}
        {guides === 'player' && (
          <g stroke="#fff" strokeOpacity=".22" strokeWidth=".3">
            <path d="M50 92 L50 27" />
            <path d="M50 92 L18 32" />
            <path d="M50 92 L82 32" />
          </g>
        )}
        {guides === 'trends' && (
          <g stroke="#fff" strokeOpacity=".28" strokeWidth=".35">
            <path d="M50 92 L18 32" />
            <path d="M50 92 L82 32" />
          </g>
        )}
        {clip && <rect x="0" y="0" width="100" height={extent} fill="url(#vig)" />}
      </g>
      <path d="M4 46 A65 65 0 0 1 96 46" fill="none" stroke="#222" strokeWidth="1.8" />
      {plate && <path d="M48.6 90.4 h2.8 v1.4 l-1.4 1.4 l-1.4 -1.4 z" fill="#fff" />}
    </>
  );
}

export interface SprayDot {
  x: number;
  y: number;
  fill: string;
}

export function SprayDots({ dots, r, stroke = '.5', opacity }: { dots: SprayDot[]; r: number; stroke?: string; opacity?: string }) {
  return (
    <>
      {dots.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={r}
          fill={s.fill}
          fillOpacity={opacity}
          stroke="#111"
          strokeWidth={stroke}
        />
      ))}
    </>
  );
}

/** A read-only spray chart: the field plus this set of balls in play. */
export function SprayField({
  dots,
  r = 1.8,
  guides = 'none',
  backdrop,
  wrapperStyle = 'background:#111;border-radius:6px;overflow:hidden',
  children,
}: {
  dots: SprayDot[];
  r?: number;
  guides?: Guides;
  backdrop?: BackdropProps;
  wrapperStyle?: string;
  children?: ReactNode;
}) {
  return (
    <div style={css(wrapperStyle)}>
      <svg viewBox="0 0 100 94" style={css('width:100%;display:block')}>
        <FieldBackdrop guides={guides} {...backdrop} />
        <SprayDots dots={dots} r={r} />
        {children}
      </svg>
    </div>
  );
}
