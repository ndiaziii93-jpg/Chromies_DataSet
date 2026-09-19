import { css, cssx } from '../lib/css';
import type { Tab } from '../lib/types';
import { useNav } from '../state/nav';
import { useScorebook } from '../state/store';
import { isConfigured } from '../state/supabase';
import { ROLE_LABEL, seesManageTab } from '../state/roles';
import { Wordmark } from './Wordmark';

const NAV: { key: Tab; label: string }[] = [
  { key: 'today', label: 'TODAY' },
  { key: 'live', label: 'LIVE' },
  { key: 'games', label: 'GAMES' },
  { key: 'players', label: 'PLAYERS' },
  { key: 'trends', label: 'TRENDS' },
  { key: 'manage', label: 'MANAGE' },
];

export function TopBar({ title, right }: { title: string; right: string }) {
  const { theme, setTheme, role, signOut, sync } = useScorebook();
  const nav = useNav();
  const dark = theme === 'dark';

  const syncNote =
    sync.state === 'error' ? 'SYNC RETRYING'
    : sync.state === 'queued' ? `QUEUED ${sync.pending || ''}`.trim()
    : sync.state === 'syncing' ? 'SYNCING'
    : '';

  return (
    <div
      style={css(
        'background:#111;color:#fff;padding:14px 20px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;position:sticky;top:0;z-index:5',
      )}
    >
      <Wordmark onClick={() => nav.go('live')} title="Go to Live scoring" />
      <span
        style={css(
          "font:600 13px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:#AAA;text-align:center;text-transform:uppercase",
        )}
      >
        {title}
      </span>
      <span style={css('display:flex;align-items:center;gap:12px')}>
        {syncNote && (
          <span
            title={sync.detail ?? 'Changes are saved on this device and sent when the network allows.'}
            style={css("font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.06em;color:#AAA")}
          >
            {syncNote}
          </span>
        )}
        <span
          style={css(
            "font:600 13px 'IBM Plex Mono',monospace;letter-spacing:.04em;color:#FFC400;font-variant-numeric:tabular-nums",
          )}
        >
          {right}
        </span>
        {isConfigured && (
          <button
            type="button"
            onClick={signOut}
            title={`Signed in as ${ROLE_LABEL[role].toLowerCase()} — sign out`}
            style={css(
              "min-height:36px;border:1.5px solid #444;border-radius:4px;background:transparent;color:#AAA;font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.06em;padding:0 10px",
            )}
          >
            {ROLE_LABEL[role]}
          </button>
        )}
        <button
          type="button"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          title="Toggle light / dark"
          style={css(
            "min-width:44px;min-height:36px;border:1.5px solid #444;border-radius:4px;background:transparent;color:#fff;font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.06em;padding:0 10px",
          )}
        >
          {dark ? 'DARK' : 'LIGHT'}
        </button>
      </span>
    </div>
  );
}

export function BottomNav() {
  const nav = useNav();
  const { role } = useScorebook();
  const tabs = NAV.filter((t) => t.key !== 'manage' || seesManageTab(role));

  return (
    <div
      style={cssx('position:sticky;bottom:0;background:#111;padding:8px 8px 14px;z-index:5;display:grid', {
        // minmax(0,1fr), not 1fr: a grid column defaults to min-width:auto and so
        // refuses to shrink below its label. Six marker-font tabs then demand about
        // 424px, more than a phone has, and the browser zooms the whole page out to
        // fit — shrinking every control in the app, not just this bar.
        gridTemplateColumns: `repeat(${tabs.length},minmax(0,1fr))`,
      })}
    >
      {tabs.map((t) => {
        const on = nav.tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => nav.go(t.key)}
            aria-current={on ? 'page' : undefined}
            style={cssx(
              // Design size on anything roomy, stepped down only where six tabs
              // genuinely will not fit across a narrow phone.
              "min-height:48px;border:0;background:transparent;font:400 clamp(10px,3vw,15px) 'Permanent Marker',cursive;letter-spacing:.04em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;white-space:nowrap",
              { color: on ? '#fff' : '#888' },
            )}
          >
            <span
              style={cssx('width:20px;height:3px;border-radius:2px', {
                background: on ? '#FFC400' : 'transparent',
              })}
            />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
