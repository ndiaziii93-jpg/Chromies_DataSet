import { useState } from 'react';
import * as E from '../engine/scoring.js';
import * as S from '../engine/stats.js';
import { css, cssx } from '../lib/css';
import type { Game } from '../lib/types';
import { ChromiesLabel } from '../components/Wordmark';
import { ResultRow } from '../components/ResultRow';
import { SectionLabel } from '../components/ui';
import { useNav } from '../state/nav';
import { can } from '../state/roles';
import { useScorebook } from '../state/store';
import { liveHeadline, useActiveGame } from '../state/live';

const LIMITS = [45, 60, 75, 90];

export function Today() {
  const { data, save, role } = useScorebook();
  const nav = useNav();
  const active = useActiveGame();

  const [opp, setOpp] = useState('');
  const [weBatFirst, setWeBatFirst] = useState(true);
  const [limit, setLimit] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const finals = data.games.filter((g) => g.status === 'final').sort((a, b) => b.date - a.date);
  const rec = S.record(finals);
  const tb = S.teamBatting(finals);
  const timeLimit = limit ?? data.settings.timeLimit;
  const inLineup = data.roster.filter((p) => p.bat).length;

  const start = () => {
    const lineup = data.roster.filter((p) => p.bat).map((p) => p.id);
    if (!lineup.length) {
      setMsg('Add players to the lineup first.');
      return;
    }
    const g = E.newGame(lineup, { weBatFirst, timeLimitMins: timeLimit }) as Game;
    const id = 'g' + Date.now();
    Object.assign(g, {
      id,
      opp: opp.trim() || (data.oppTeam || '').trim() || 'Opponent',
      date: Date.now(),
      oppLineup: (data.oppLineup || [])
        .filter((o) => o.num || o.name.trim())
        .map((o) => ({ num: o.num, name: o.name.trim() })),
      oppIdx: 0,
    });
    save({ ...data, games: [...data.games, g], activeId: id });
    setOpp('');
    setWeBatFirst(true);
    setLimit(null);
    setMsg('');
    nav.setSide('score');
    nav.go('live');
  };

  return (
    <div
      style={css(
        'padding:20px;display:flex;flex-direction:column;gap:20px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box',
      )}
    >
      {active && <InProgressCard game={active} canResume={can(role, 'score')} />}

      {!active && can(role, 'startGame') && (
        <div
          style={css(
            'background:var(--card);border:1.5px solid var(--line-strong);border-radius:6px;overflow:hidden',
          )}
        >
          <div
            style={css(
              "padding:12px 16px;background:#111;color:#fff;font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.08em",
            )}
          >
            NEW GAME
          </div>
          <div style={css('padding:16px;display:flex;flex-direction:column;gap:14px')}>
            <label
              style={css(
                "display:flex;flex-direction:column;gap:6px;font:600 12px 'IBM Plex Mono',monospace;color:var(--muted);letter-spacing:.06em",
              )}
            >
              OPPONENT
              <input
                value={opp}
                onChange={(e) => setOpp(e.target.value)}
                placeholder={(data.oppTeam || '').trim() || 'e.g. Rockets'}
                style={css(
                  "min-height:48px;border:1.5px solid var(--line-strong);border-radius:4px;padding:0 14px;font:500 16px 'IBM Plex Sans',sans-serif;background:var(--card)",
                )}
              />
            </label>

            <div
              style={css(
                "display:flex;flex-direction:column;gap:6px;font:600 12px 'IBM Plex Mono',monospace;color:var(--muted);letter-spacing:.06em",
              )}
            >
              WHO BATS FIRST
              <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:4px')}>
                <Toggle on={weBatFirst} onClick={() => setWeBatFirst(true)}>
                  Chromies (away)
                </Toggle>
                <Toggle on={!weBatFirst} onClick={() => setWeBatFirst(false)}>
                  Opponent (home)
                </Toggle>
              </div>
            </div>

            <div
              style={css(
                "display:flex;flex-direction:column;gap:6px;font:600 12px 'IBM Plex Mono',monospace;color:var(--muted);letter-spacing:.06em",
              )}
            >
              TIME LIMIT
              <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:4px')}>
                {LIMITS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLimit(m)}
                    style={cssx(
                      "min-height:44px;border:1.5px solid var(--line-strong);border-radius:4px;font:600 14px 'IBM Plex Mono',monospace",
                      {
                        background: timeLimit === m ? '#111' : 'var(--card)',
                        color: timeLimit === m ? '#fff' : 'var(--ink)',
                      },
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            <div style={css('font-size:13px;color:var(--muted);line-height:1.5')}>
              Batting order comes from Manage → Roster ({inLineup} in the lineup).
            </div>
            {msg && (
              <div style={css("font:500 12px 'IBM Plex Mono',monospace;color:var(--muted)")}>{msg}</div>
            )}
            <button
              type="button"
              onClick={start}
              style={css(
                "min-height:56px;border:0;border-radius:4px;background:#111;color:#fff;font:700 16px 'IBM Plex Sans',sans-serif",
              )}
            >
              Start game
            </button>
          </div>
        </div>
      )}

      <div style={css('display:flex;flex-direction:column;gap:8px')}>
        <SectionLabel>SEASON · {finals.length} GP</SectionLabel>
        <div
          style={css(
            'display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;background:#111;border:1.5px solid var(--line-strong);border-radius:6px;overflow:hidden',
          )}
        >
          <Tile value={`${rec.w}–${rec.l}${rec.t ? '–' + rec.t : ''}`} label="Record" />
          <Tile value={`${rec.rf} / ${rec.ra}`} label="Runs for / against" tabular />
          <Tile value={finals.length ? S.fmt3(tb.avg) : '—'} label="Team AVG" />
          <Tile value={finals.length ? S.fmt3(tb.obp) : '—'} label="Team OBP" />
        </div>
      </div>

      <div style={css('display:flex;flex-direction:column;gap:8px')}>
        <div style={css('display:flex;justify-content:space-between;align-items:baseline')}>
          <SectionLabel>RECENT</SectionLabel>
          <button
            type="button"
            onClick={() => nav.go('games')}
            style={css(
              "border:0;background:none;font:600 12px 'IBM Plex Mono',monospace;color:var(--ink);text-decoration:underline;padding:0",
            )}
          >
            All games
          </button>
        </div>
        {!finals.length && (
          <div
            style={css(
              'background:var(--card);border-radius:6px;padding:18px;font-size:14px;color:var(--muted);line-height:1.5;text-wrap:pretty',
            )}
          >
            No completed games.{' '}
            {can(role, 'startGame')
              ? 'Start one above, or load the sample season from Manage → Data.'
              : 'Results appear here once a game is scored.'}
          </div>
        )}
        <div style={css('display:flex;flex-direction:column;gap:6px')}>
          {finals.slice(0, 3).map((g) => (
            <ResultRow key={g.id} game={g} />
          ))}
        </div>
      </div>
    </div>
  );
}

function InProgressCard({ game, canResume }: { game: Game; canResume: boolean }) {
  const nav = useNav();
  const head = liveHeadline(game);
  return (
    <div style={css('background:#111;color:#fff;border-radius:6px;overflow:hidden')}>
      <div
        style={css(
          "padding:12px 16px;display:flex;justify-content:space-between;font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.08em;border-bottom:1px solid #333",
        )}
      >
        <span>
          <span style={css('color:#FFC400')}>●</span> IN PROGRESS · VS {game.opp.toUpperCase()}
        </span>
        <span>
          {head.inning} · {game.outs} OUT
        </span>
      </div>
      <div
        style={css(
          'padding:18px 16px;display:grid;grid-template-columns:1fr auto;gap:8px 16px;align-items:center',
        )}
      >
        <span style={css("font:600 20px 'IBM Plex Sans',sans-serif")}>
          <ChromiesLabel />
        </span>
        <span
          style={css(
            "font:700 44px/1 'IBM Plex Mono',monospace;color:#FFC400;font-variant-numeric:tabular-nums",
          )}
        >
          {head.us}
        </span>
        <span style={css("font:600 20px 'IBM Plex Sans',sans-serif;color:#AAA")}>{game.opp}</span>
        <span
          style={css("font:700 44px/1 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums")}
        >
          {head.them}
        </span>
      </div>
      <button
        type="button"
        onClick={() => nav.go('live')}
        style={css(
          "width:100%;min-height:56px;border:0;background:#FFC400;color:#111111;font:700 16px 'IBM Plex Sans',sans-serif",
        )}
      >
        {canResume ? 'Resume scoring →' : 'Watch live →'}
      </button>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={cssx(
        "min-height:44px;border:1.5px solid var(--line-strong);border-radius:4px;font:600 14px 'IBM Plex Sans',sans-serif",
        { background: on ? '#111' : 'var(--card)', color: on ? '#fff' : 'var(--ink)' },
      )}
    >
      {children}
    </button>
  );
}

function Tile({ value, label, tabular }: { value: string; label: string; tabular?: boolean }) {
  return (
    <div style={css('background:var(--card);padding:16px;display:flex;flex-direction:column;gap:2px;min-width:0')}>
      <span
        style={css(
          "font:700 26px/1.2 'IBM Plex Mono',monospace;white-space:nowrap" +
            (tabular ? ';font-variant-numeric:tabular-nums' : ''),
        )}
      >
        {value}
      </span>
      <span style={css('font-size:12px;color:var(--muted)')}>{label}</span>
    </div>
  );
}
