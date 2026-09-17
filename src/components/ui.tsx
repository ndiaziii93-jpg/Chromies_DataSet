import { useState, type CSSProperties, type ReactNode } from 'react';
import { css, cssx } from '../lib/css';

/**
 * A button with a pressed state, matching the prototype's `style-active`.
 * At the field a tap needs to land visibly before the ball does, so the active
 * style is applied on pointer-down rather than waiting for the click.
 */
export function PressKey({
  base,
  active,
  onClick,
  disabled,
  title,
  children,
  style,
}: {
  base: string;
  active: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const [down, setDown] = useState(false);
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      style={{ ...css(base), ...(down ? css(active) : null), ...style }}
    >
      {children}
    </button>
  );
}

export interface BinderTab {
  key: string;
  label: string;
  title: string;
}

/**
 * The left-edge binder tabs on Players, Trends and Manage. They are the filter
 * for everything inside the frame they're attached to.
 */
export function BinderTabs({
  tabs,
  active,
  onPick,
  minHeight = 72,
  fontSize = 15,
  padding = '12px 9px',
}: {
  tabs: BinderTab[];
  active: string;
  onPick: (key: string) => void;
  minHeight?: number;
  fontSize?: number;
  padding?: string;
}) {
  return (
    <div
      style={css(
        'display:flex;flex-direction:column;gap:3px;padding-top:14px;align-self:start;position:sticky;top:74px',
      )}
    >
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t.key)}
            title={t.title}
            aria-pressed={on}
            style={cssx(
              "writing-mode:vertical-rl;transform:rotate(180deg);border:1.5px solid var(--line-strong);border-left:0;border-radius:0 8px 8px 0;margin-right:-1.5px;font-family:'Permanent Marker',cursive;font-weight:400;letter-spacing:.04em;white-space:nowrap",
              {
                minHeight: minHeight + 'px',
                padding,
                fontSize: fontSize + 'px',
                borderRight: `3px solid ${on ? '#FFC400' : 'var(--line)'}`,
                background: on ? '#111' : 'var(--card)',
                color: on ? '#FFC400' : 'var(--ink)',
              },
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** The bordered page the binder tabs are bound into. */
export function BinderFrame({ children, gap = 18 }: { children: ReactNode; gap?: number }) {
  return (
    <div
      style={cssx(
        'display:flex;flex-direction:column;min-width:0;border:1.5px solid var(--line-strong);border-radius:0 8px 8px 8px;padding:16px;background:var(--card2)',
        { gap: gap + 'px' },
      )}
    >
      {children}
    </div>
  );
}

export function BinderLayout({ children }: { children: ReactNode }) {
  return <div style={css('display:grid;grid-template-columns:auto 1fr;gap:0;align-items:stretch')}>{children}</div>;
}

export const SECTION_LABEL =
  "font:600 11px 'IBM Plex Mono',monospace;color:var(--muted2);letter-spacing:.08em";

export function SectionLabel({ children, pad }: { children: ReactNode; pad?: string }) {
  return <div style={css(SECTION_LABEL + (pad ? ';padding-top:' + pad : ''))}>{children}</div>;
}

/** Full-screen scrim + panel, shared by the player game call and the position picker. */
export function Modal({
  width,
  onClose,
  children,
}: {
  width: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={css(
        'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:20;display:flex;align-items:center;justify-content:center;padding:16px',
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={cssx(
          'background:#111;color:#fff;border-radius:8px;max-height:100%;overflow:auto;display:flex;flex-direction:column',
          { width },
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** The contact-mix bars on the player card and on Trends. */
export function ContactBars({ rows }: { rows: { k: string; v: string; w: string }[] }) {
  return (
    <>
      {rows.map((c) => (
        <div
          key={c.k}
          style={css(
            "display:grid;grid-template-columns:36px 1fr 44px;gap:10px;align-items:center;font:500 13px 'IBM Plex Mono',monospace",
          )}
        >
          <span style={css('color:var(--muted)')}>{c.k}</span>
          <div style={css('height:14px;background:var(--line);border-radius:2px;overflow:hidden')}>
            <div style={cssx('height:100%;background:var(--ink)', { width: c.w })} />
          </div>
          <span style={css('text-align:right')}>{c.v}</span>
        </div>
      ))}
    </>
  );
}
