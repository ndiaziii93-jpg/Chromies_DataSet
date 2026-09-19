import * as S from '../engine/stats.js';
import * as A from '../engine/analysis.js';
import { css, cssx } from '../lib/css';
import type { Game, Player, Position, RangeKey } from '../lib/types';
import { applyRange, RANGE_TABS, rangeTitle } from '../lib/ranges';
import { SprayField } from '../components/Field';
import {
  BinderFrame, BinderLayout, BinderTabs, ContactBars, Modal, SectionLabel,
} from '../components/ui';
import { wl } from '../components/ResultRow';
import { useNav } from '../state/nav';
import { useScorebook } from '../state/store';

const POS_LONG: Record<Position, string> = {
  P: 'Pitcher', C: 'Catcher', '1B': 'First base', '2B': 'Second base', '3B': 'Third base',
  SS: 'Shortstop', LF: 'Left field', LC: 'Left-center', RC: 'Right-center', RF: 'Right field',
  EH: 'Extra hitter', UT: 'Utility',
};

const pct = (v: number) => Math.round(v * 100) + '%';

export function Players() {
  const { data } = useScorebook();
  const nav = useNav();
  const selected = data.roster.find((p) => p.id === nav.playerId);
  return selected ? <PlayerCard player={selected} /> : <PlayerList />;
}

function PlayerList() {
  const { data } = useScorebook();
  const nav = useNav();
  const finals = data.games.filter((g) => g.status === 'final');
  const rows = data.roster
    .map((p) => ({ p, s: S.batting(finals, p.id) }))
    .sort((a, b) => b.s.avg - a.s.avg || b.s.h - a.s.h);

  const GRID =
    'display:grid;grid-template-columns:44px minmax(120px,1fr) 44px repeat(6,52px);gap:6px;min-width:560px';

  return (
    <div
      style={css(
        'padding:20px;display:flex;flex-direction:column;gap:10px;max-width:900px;width:100%;margin:0 auto;box-sizing:border-box',
      )}
    >
      <SectionLabel>ROSTER · {data.roster.length} · SORTED BY AVG</SectionLabel>
      <div style={css('background:var(--card);border-radius:6px;overflow:hidden;overflow-x:auto')}>
        <div
          style={css(
            GRID + ";padding:10px 14px;background:#111;color:#AAA;font:500 11px 'IBM Plex Mono',monospace",
          )}
        >
          <span>NO</span>
          <span>PLAYER</span>
          <span>POS</span>
          {['GP', 'AB', 'H', 'RBI', 'AVG', 'OBP'].map((h) => (
            <span key={h} style={css('text-align:right')}>
              {h}
            </span>
          ))}
        </div>
        {rows.map(({ p, s }) => (
          <button
            key={p.id}
            type="button"
            onClick={() => nav.openPlayer(p.id)}
            style={css(
              GRID +
                ";width:100%;align-items:center;padding:11px 14px;border:0;border-top:1px solid var(--line);background:var(--card);text-align:left;font:500 13px 'IBM Plex Mono',monospace;box-sizing:border-box",
            )}
          >
            <span style={css('font-weight:700')}>{p.num}</span>
            <span style={css("font:600 14px 'IBM Plex Sans',sans-serif")}>{p.name}</span>
            <span style={css('color:var(--muted2)')}>{p.pos}</span>
            <span style={css('text-align:right')}>{s.games}</span>
            <span style={css('text-align:right')}>{s.ab}</span>
            <span style={css('text-align:right')}>{s.h}</span>
            <span style={css('text-align:right')}>{s.rbi}</span>
            <span style={css('text-align:right;font-weight:700')}>{s.ab ? S.fmt3(s.avg) : '—'}</span>
            <span style={css('text-align:right')}>{s.pa ? S.fmt3(s.obp) : '—'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ player }: { player: Player }) {
  const { data, fmtDate } = useScorebook();
  const nav = useNav();

  const finals = data.games.filter((g) => g.status === 'final');
  const ranged = applyRange(finals, nav.pdRange);
  const s = S.batting(ranged, player.id);
  const f = S.fielding(ranged, player.pos);
  const analysis = A.playerAnalysis(ranged, player, data.roster);

  const contactTotal = Object.values(s.contact).reduce((a, b) => a + b, 0) || 1;
  const stats = [
    { k: 'AVG', v: s.ab ? S.fmt3(s.avg) : '—' },
    { k: 'OBP', v: s.pa ? S.fmt3(s.obp) : '—' },
    { k: 'SLG', v: s.ab ? S.fmt3(s.slg) : '—' },
    { k: 'H', v: String(s.h) },
    { k: 'XBH', v: String(s.b2 + s.b3 + s.hr) },
    { k: 'RBI', v: String(s.rbi) },
    { k: 'BB', v: String(s.bb) },
    { k: 'K', v: String(s.k) },
    // No base comes of it, so it earns a tile only once it has happened.
    ...(s.hbp ? [{ k: 'HBP', v: String(s.hbp) }] : []),
  ];

  const gamelog = [...ranged]
    .reverse()
    .filter((g) => g.lineup.includes(player.id) || g.log.some((l) => 'batter' in l && l.batter === player.id))
    .map((g) => {
      const t = S.batting([g], player.id);
      return {
        g,
        date: fmtDate(g.date, true),
        line:
          `${t.h}-${t.ab}${t.rbi ? ', ' + t.rbi + ' RBI' : ''}` +
          `${t.bb ? ', ' + t.bb + ' BB' : ''}${t.k ? ', ' + t.k + ' K' : ''}`,
      };
    });

  const modalGame = data.games.find((g) => g.id === nav.pgGame) ?? null;

  return (
    <div style={css('display:flex;flex-direction:column')}>
      <div style={css('background:#111;color:#fff;padding:18px 20px 22px')}>
        <div style={css('max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:12px')}>
          <button
            type="button"
            onClick={() => nav.openPlayer(null)}
            style={css(
              "align-self:flex-start;border:0;background:none;padding:0;font:600 13px 'IBM Plex Mono',monospace;color:#AAA",
            )}
          >
            ‹ PLAYERS
          </button>
          <div style={css('display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center')}>
            <span
              style={css(
                "font:700 84px/.9 'IBM Plex Mono',monospace;color:#FFC400;font-variant-numeric:tabular-nums",
              )}
            >
              {player.num}
            </span>
            <div style={css('display:flex;flex-direction:column;gap:4px')}>
              <span style={css("font:700 30px/1.1 'IBM Plex Sans',sans-serif")}>{player.name}</span>
              <span style={css("font:500 12px 'IBM Plex Mono',monospace;color:#AAA;letter-spacing:.06em")}>
                {(POS_LONG[player.pos] ?? player.pos).toUpperCase()} · #{player.num}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={css(
          'padding:20px;display:flex;flex-direction:column;gap:18px;max-width:940px;width:100%;margin:0 auto;box-sizing:border-box',
        )}
      >
        <BinderLayout>
          <BinderTabs
            tabs={RANGE_TABS}
            active={nav.pdRange}
            onPick={(k) => nav.setPdRange(k as RangeKey)}
          />
          <BinderFrame>
            <SectionLabel>
              {rangeTitle(nav.pdRange)} · {s.games} GP · {s.pa} PA
            </SectionLabel>

            <div
              style={css(
                'display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:1px;background:#111;border:1.5px solid var(--line-strong);border-radius:6px;overflow:hidden',
              )}
            >
              {stats.map((st) => (
                <div
                  key={st.k}
                  style={css(
                    'background:var(--card);padding:14px 12px;display:flex;flex-direction:column;align-items:center;gap:2px',
                  )}
                >
                  <span style={css("font:700 26px/1 'IBM Plex Mono',monospace")}>{st.v}</span>
                  <span style={css("font:500 11px 'IBM Plex Mono',monospace;color:var(--muted2)")}>
                    {st.k}
                  </span>
                </div>
              ))}
            </div>

            <div style={css('display:flex;flex-direction:column;gap:8px')}>
              <div style={css('display:flex;justify-content:space-between;align-items:baseline')}>
                <SectionLabel>PLAYER ANALYSIS</SectionLabel>
                <span style={css("font:500 11px 'IBM Plex Mono',monospace;color:var(--muted3)")}>
                  season to date · from the logs
                </span>
              </div>
              <div
                style={css(
                  'background:#111;color:#fff;border-radius:6px;padding:18px 20px;display:flex;flex-direction:column;gap:14px',
                )}
              >
                {analysis.note && <div style={css('font-size:14px;color:#DDD')}>{analysis.note}</div>}
                <div
                  style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px')}
                >
                  <Column title="CONTRIBUTION" lines={analysis.contribution} />
                  <Column title="STRENGTHS & TENDENCIES" lines={analysis.strengths} />
                  <Column
                    title="TRENDS"
                    lines={analysis.trends}
                    fallback={
                      !analysis.trends.length && !analysis.note ? 'Trends need a few more games.' : undefined
                    }
                  />
                </div>
              </div>
            </div>

            <div
              style={css(
                'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start',
              )}
            >
              <div style={css('display:flex;flex-direction:column;gap:8px')}>
                <div style={css('display:flex;justify-content:space-between;align-items:baseline')}>
                  <SectionLabel>SPRAY · {s.bip} BALLS IN PLAY</SectionLabel>
                  <span style={css('font-size:12px;color:var(--muted)')}>○ hit · ● out</span>
                </div>
                <SprayField
                  guides="player"
                  r={1.9}
                  dots={s.spray.map((p) => ({ x: p.x, y: p.y, fill: p.hit ? '#FFFFFF' : '#111111' }))}
                />
                <div
                  style={css(
                    "display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font:600 12px 'IBM Plex Mono',monospace;text-align:center",
                  )}
                >
                  <Zone bg="#111" label="PULL" value={pct(s.pull)} size={20} />
                  <Zone bg="#444" label="CENTER" value={pct(s.center)} size={20} />
                  <Zone bg="#999" label="OPPO" value={pct(Math.max(0, s.oppo))} size={20} />
                </div>
              </div>

              <div style={css('display:flex;flex-direction:column;gap:8px')}>
                <SectionLabel>CONTACT MIX</SectionLabel>
                <div
                  style={css(
                    'background:var(--card);border-radius:6px;padding:14px;display:flex;flex-direction:column;gap:8px',
                  )}
                >
                  <ContactBars
                    rows={(['GB', 'FB', 'LD', 'PU'] as const).map((k) => ({
                      k,
                      v: pct(s.contact[k] / contactTotal),
                      w: pct(s.contact[k] / contactTotal),
                    }))}
                  />
                </div>

                <SectionLabel pad="8px">FIELDING AT {player.pos}</SectionLabel>
                <div
                  style={css(
                    "background:var(--card);border-radius:6px;padding:14px;display:grid;grid-template-columns:repeat(3,1fr);font:500 13px 'IBM Plex Mono',monospace;text-align:center",
                  )}
                >
                  {(['PO', 'A', 'E'] as const).map((k) => (
                    <span key={k} style={css('display:flex;flex-direction:column;gap:2px')}>
                      <span style={css("font:700 24px 'IBM Plex Mono',monospace")}>{f[k]}</span>
                      <span style={css('color:var(--muted2)')}>{k}</span>
                    </span>
                  ))}
                </div>

                <div
                  style={css('display:flex;justify-content:space-between;align-items:baseline;padding-top:8px')}
                >
                  <SectionLabel>GAME LOG</SectionLabel>
                  <span style={css("font:500 11px 'IBM Plex Mono',monospace;color:var(--muted3)")}>
                    tap a game for the call
                  </span>
                </div>
                <div style={css('background:var(--card);border-radius:6px;overflow:hidden')}>
                  {gamelog.map((row) => (
                    <button
                      key={row.g.id}
                      type="button"
                      onClick={() => nav.setPgGame(row.g.id)}
                      style={css(
                        "width:100%;border:0;border-top:1px solid var(--line);background:var(--card);padding:10px 14px;display:grid;grid-template-columns:1fr auto;gap:10px;font:500 13px 'IBM Plex Mono',monospace;text-align:left",
                      )}
                    >
                      <span>
                        <span style={css('color:var(--muted2)')}>{row.date}</span> · {row.g.opp}
                      </span>
                      <span style={css('font-weight:600')}>{row.line}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </BinderFrame>
        </BinderLayout>
      </div>

      {modalGame && <GameCallModal game={modalGame} player={player} />}
    </div>
  );
}

function Column({ title, lines, fallback }: { title: string; lines: string[]; fallback?: string }) {
  return (
    <div style={css('display:flex;flex-direction:column;gap:6px')}>
      <span style={css("font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.1em;color:#FFC400")}>
        {title}
      </span>
      {fallback && <div style={css('font-size:14px;color:#999')}>{fallback}</div>}
      {lines.map((t, i) => (
        <div key={i} style={css('font-size:14px;line-height:1.5;color:#DDD;text-wrap:pretty')}>
          {t}
        </div>
      ))}
    </div>
  );
}

function Zone({ bg, label, value, size }: { bg: string; label: string; value: string; size: number }) {
  return (
    <div style={cssx('color:#fff;padding:12px 6px;border-radius:4px', { background: bg })}>
      {label}
      <br />
      <span style={cssx('', { fontSize: size + 'px' })}>{value}</span>
    </div>
  );
}

function GameCallModal({ game: g, player }: { game: Game; player: Player }) {
  const { data, fmtDate } = useScorebook();
  const nav = useNav();
  const r = A.playerGameAnalysis(g, player, data.games);
  const t = S.batting([g], player.id);
  const line = t.pa
    ? `${t.h}-for-${t.ab}${t.rbi ? ', ' + t.rbi + ' RBI' : ''}${t.bb ? ', ' + t.bb + ' BB' : ''}` +
      `${t.r ? ', ' + t.r + ' R' : ''}${t.k ? ', ' + t.k + ' K' : ''}`
    : 'Did not bat';

  const close = () => nav.setPgGame(null);

  return (
    <Modal width="min(620px,100%)" onClose={close}>
      <div
        style={css(
          'padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #333',
        )}
      >
        <div style={css('display:flex;flex-direction:column;gap:4px')}>
          <span style={css("font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.1em;color:#FFC400")}>
            {wl(g)} {g.score.us}–{g.score.them} · VS {g.opp} · {fmtDate(g.date)}
          </span>
          <span style={css("font:700 22px 'IBM Plex Sans',sans-serif")}>
            #{player.num} {player.name.trim()}
          </span>
          <span style={css("font:600 14px 'IBM Plex Mono',monospace;color:#CCC")}>{line}</span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          style={css(
            'min-width:44px;min-height:40px;border:1.5px solid #444;border-radius:4px;background:transparent;color:#fff;font-size:18px',
          )}
        >
          ×
        </button>
      </div>

      <div style={css('padding:18px 20px;display:grid;grid-template-columns:1fr 180px;gap:18px;align-items:start')}>
        <div style={css('display:flex;flex-direction:column;gap:12px')}>
          <div style={css("font:600 19px/1.35 'IBM Plex Sans',sans-serif;text-wrap:pretty")}>
            {r.headline}
          </div>
          {r.lines.map((t2, i) => (
            <div key={i} style={css('font-size:14px;line-height:1.55;color:#DDD;text-wrap:pretty')}>
              {t2}
            </div>
          ))}
        </div>
        <div style={css('display:flex;flex-direction:column;gap:6px')}>
          <span style={css("font:600 10px 'IBM Plex Mono',monospace;letter-spacing:.1em;color:#AAA")}>
            BALLS IN PLAY
          </span>
          <SprayField
            wrapperStyle="background:#000;border-radius:6px;overflow:hidden"
            backdrop={{ mow: false, mound: false }}
            r={2.4}
            dots={t.spray.map((p) => ({ x: p.x, y: p.y, fill: p.hit ? '#FFFFFF' : '#111111' }))}
          />
          <span style={css('font-size:11px;color:#AAA')}>○ hit · ● out</span>
        </div>
      </div>

      <div style={css('padding:0 20px 18px;display:flex;gap:8px')}>
        <button
          type="button"
          onClick={() => {
            nav.setPgGame(null);
            nav.openGame(g.id);
          }}
          style={css(
            "min-height:44px;padding:0 16px;border:0;border-radius:4px;background:#FFC400;color:#111111;font:600 13px 'IBM Plex Sans',sans-serif",
          )}
        >
          Full game recap
        </button>
        <button
          type="button"
          onClick={close}
          style={css(
            "min-height:44px;padding:0 16px;border:1.5px solid #444;border-radius:4px;background:transparent;color:#fff;font:600 13px 'IBM Plex Sans',sans-serif",
          )}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
