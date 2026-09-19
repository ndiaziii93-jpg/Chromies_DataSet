import { useEffect, useState, type MouseEvent } from 'react';
import * as E from '../engine/scoring.js';
import * as S from '../engine/stats.js';
import { css, cssx } from '../lib/css';
import type { Game, LogEntry, Outcome, PlayLog, SidePanel } from '../lib/types';
import { ChromiesLabel } from '../components/Wordmark';
import { FieldBackdrop, SprayDots } from '../components/Field';
import { PressKey, SectionLabel } from '../components/ui';
import { useNav } from '../state/nav';
import { can } from '../state/roles';
import { useScorebook } from '../state/store';
import { useActiveGame } from '../state/live';

const KEY_H = '56px';
const SHORT: Partial<Record<Outcome, string>> = {
  BB: 'Walk', HBP: 'no base', E: 'Error', FC: "Fielder's ch.", K: 'Strikeout',
  GO: 'Ground out', FO: 'Fly out', LO: 'Line out', PO: 'Pop out', SF: 'Sac fly', DP: 'Double play',
};

const isPlay = (l: LogEntry): l is PlayLog => !l.manager && !l.scoreOnly;

export function Live() {
  const { data, patchGame, pname, pnum, role } = useScorebook();
  const nav = useNav();
  const active = useActiveGame();

  // The clock is the only thing on the page that moves on its own.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const [oppEntry, setOppEntry] = useState('');

  if (!active) return <NoGame />;

  const scoring = can(role, 'score');
  const inP = active.status === 'in_progress';
  const us = E.weAreBatting(active);
  const oppTurn = !us && inP;
  const scoreOnly = oppTurn && active.mode === 'score_only';

  const oppL =
    active.oppLineup?.length
      ? active.oppLineup
      : (data.oppLineup || []).filter((o) => o.num || (o.name || '').trim());
  const oppLabel = (o?: { num: string; name: string }) =>
    o ? (o.num ? '#' + o.num : '') + (o.name ? (o.num ? ' ' : '') + o.name : '') : '';
  const oppAuto = oppTurn && active.mode === 'full' && oppL.length > 0;

  // With an opposition lineup loaded the next batter is filled in for the scorer
  // rather than asked for; the jersey number pad is the fallback.
  const g: Game =
    oppAuto && !active.oppBatter
      ? { ...active, oppBatter: oppLabel(oppL[(active.oppIdx || 0) % oppL.length]) }
      : active;

  const needsOpp = oppTurn && active.mode === 'full' && !g.oppBatter && !oppAuto;
  const showGrid = !scoreOnly && !needsOpp && inP;

  const set = (next: Game) => {
    let n = next;
    if (oppAuto && n.log.length > g.log.length && n.oppBatter === null && !E.weAreBatting(g)) {
      n = { ...n, oppIdx: ((g.oppIdx || 0) + 1) % oppL.length };
    }
    patchGame(g.id, n);
  };

  const plays = g.log.filter((l) => !l.manager);
  const lastEntry = plays[plays.length - 1];
  const last = !lastEntry
    ? 'No plays yet'
    : lastEntry.scoreOnly
      ? 'Run recorded (score only)'
      : `${pname((lastEntry as PlayLog).batter)} · ${E.LABEL[(lastEntry as PlayLog).outcome]}` +
        `${(lastEntry as PlayLog).fielder ? ' to ' + (lastEntry as PlayLog).fielder : ''}` +
        `${(lastEntry as PlayLog).contact && (lastEntry as PlayLog).contact !== 'none' ? ' · ' + (lastEntry as PlayLog).contact : ''}` +
        `${(lastEntry as PlayLog).rbi ? ' · ' + (lastEntry as PlayLog).rbi + ' RBI' : ''}`;

  const lastPlay = lastEntry && isPlay(lastEntry) ? lastEntry : null;
  const coord = g.pending
    ? 'awaiting field tap'
    : lastPlay && lastPlay.fieldX != null
      ? `x ${lastPlay.fieldX} · y ${lastPlay.fieldY} · ${lastPlay.fielder} · ${lastPlay.contact}`
      : 'x — · y —';

  const bIdx = g.batterIdx % g.lineup.length;
  const bId = g.lineup[bIdx];
  const batter = !inP
    ? 'Final'
    : us
      ? `${pnum(bId)} ${pname(bId)}`
      : g.oppBatter
        ? oppAuto
          ? g.oppBatter
          : 'Opp #' + g.oppBatter
        : 'set batter';

  const spray = plays
    .filter((l): l is PlayLog => isPlay(l) && l.fieldX != null && S.usLog(g, l))
    .map((l) => ({ x: l.fieldX!, y: l.fieldY!, fill: S.HITS.has(l.outcome) ? '#FFFFFF' : '#111111' }));

  const bases = [1, 2, 3].map((i) => {
    const p = E.BASE_XY[i];
    const runner = g.bases[i - 1];
    return {
      i,
      rx: p.x - 3.25,
      ry: p.y - 3.25,
      rot: `rotate(45 ${p.x} ${p.y})`,
      pctX: p.x + '%',
      pctY: (i === 2 ? ((p.y - 12) / 94) * 100 : ((p.y + 4) / 94) * 100) + '%',
      fill: runner ? '#FFC400' : '#FFFFFF',
      name: runner ? pnum(runner) : '',
    };
  });

  const line = S.lineScore(g);
  const half = g.half === 'top' ? '▲' : '▼';
  const inningLabel = !inP ? 'FINAL' : `${half} ${E.ordinal(g.inning).toUpperCase()}`;
  const finals = data.games.filter((x) => x.status === 'final');

  const onField = (e: MouseEvent<SVGSVGElement>) => {
    if (!g.pending || !scoring) return;
    const r = e.currentTarget.getBoundingClientRect();
    set(
      E.recordField(
        g,
        Math.round(((e.clientX - r.left) / r.width) * 100),
        Math.round(((e.clientY - r.top) / r.height) * 94),
      ),
    );
  };

  const mkKey = (code: Outcome) => ({
    code,
    label: E.LABEL[code],
    short: SHORT[code] ?? E.LABEL[code],
    onTap: () => set(E.recordOutcome(g, code)),
  });

  return (
    <div style={css('display:flex;flex-direction:column;min-height:0')}>
      {/* Scorebug */}
      <div
        style={css(
          'background:#111;color:#fff;padding:12px 20px 14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 24px;overflow-x:auto',
        )}
      >
        <table
          style={css("border-collapse:collapse;font:500 14px 'IBM Plex Mono',monospace;white-space:nowrap")}
        >
          <thead>
            <tr style={css('color:#888;font-size:11px')}>
              <th style={css('text-align:left;padding:0 12px 4px 0;font-weight:500')} />
              {line.innings.map((n) => (
                <th key={n} style={css('padding:0 7px 4px;font-weight:500;min-width:18px')}>
                  {n}
                </th>
              ))}
              <th style={css('padding:0 8px 4px 18px;font-weight:600;color:#fff')}>R</th>
              <th style={css('padding:0 8px 4px;font-weight:500')}>H</th>
              <th style={css('padding:0 8px 4px;font-weight:500')}>E</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={css("padding:3px 12px 3px 0;font-family:'IBM Plex Sans',sans-serif;font-weight:600")}>
                <ChromiesLabel />
              </td>
              {line.us.map((c, i) => (
                <td key={i} style={css('padding:3px 7px;text-align:center')}>
                  {c.v}
                </td>
              ))}
              <td style={css('padding:3px 8px 3px 18px;text-align:center;font-weight:700;background:#FFC400;color:#111111')}>
                {g.score.us}
              </td>
              <td style={css('padding:3px 8px;text-align:center')}>{line.hitsUs}</td>
              <td style={css('padding:3px 8px;text-align:center')}>{line.errUs}</td>
            </tr>
            <tr>
              <td style={css("padding:3px 12px 3px 0;font-family:'IBM Plex Sans',sans-serif;font-weight:600;color:#AAA")}>
                {g.opp}
              </td>
              {line.them.map((c, i) => (
                <td key={i} style={css('padding:3px 7px;text-align:center')}>
                  {c.v}
                </td>
              ))}
              <td style={css('padding:3px 8px 3px 18px;text-align:center;font-weight:700;background:#333')}>
                {g.score.them}
              </td>
              <td style={css('padding:3px 8px;text-align:center')}>{line.hitsThem}</td>
              <td style={css('padding:3px 8px;text-align:center')}>{line.errThem}</td>
            </tr>
          </tbody>
        </table>
        <div
          style={css(
            "display:flex;align-items:center;gap:18px;font:600 13px 'IBM Plex Mono',monospace;letter-spacing:.04em",
          )}
        >
          <span style={css('color:#FFC400')}>{inningLabel}</span>
          <span style={css('display:flex;align-items:center;gap:6px')}>
            OUT
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={cssx('width:12px;height:12px;border-radius:2px;border:1.5px solid #fff', {
                  background: i < g.outs ? '#FFC400' : 'transparent',
                })}
              />
            ))}
          </span>
          <span style={css('color:#AAA')}>{E.timeLeft(g)}</span>
        </div>
      </div>

      <div
        style={css(
          'display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;padding:16px 20px 20px',
        )}
      >
        {/* Field */}
        <div style={css('display:flex;flex-direction:column;gap:10px;min-width:0')}>
          <div style={css('display:flex;justify-content:space-between;align-items:baseline;gap:10px')}>
            <span style={css("font:600 16px 'IBM Plex Sans',sans-serif")}>
              <span style={css('color:var(--muted);font-weight:500')}>
                {us ? 'Chromies batting' : g.opp + ' batting'} ·{' '}
              </span>
              {batter}
            </span>
            <span
              style={css("font:500 12px 'IBM Plex Mono',monospace;color:var(--muted);white-space:nowrap")}
            >
              {coord}
            </span>
          </div>

          <div style={css('position:relative;background:#111;border-radius:6px;overflow:hidden')}>
            <svg
              viewBox="0 0 100 94"
              onClick={onField}
              style={cssx('width:100%;display:block;touch-action:manipulation', {
                cursor: scoring ? 'crosshair' : 'default',
              })}
            >
              <FieldBackdrop clip guides="live" rubber batterBoxes plate />
              {E.FIELDERS.map((f) => (
                <g key={f.pos} style={css('pointer-events:none')}>
                  <circle cx={f.x} cy={f.y} r="3" fill="#fff" stroke="#111" strokeWidth=".5" />
                  <text
                    x={f.x}
                    y={f.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={css("font:600 2.6px 'IBM Plex Mono',monospace;fill:#111")}
                  >
                    {f.pos}
                  </text>
                </g>
              ))}
              <g style={css('pointer-events:none')}>
                <SprayDots dots={spray} r={1.6} />
              </g>
              {bases.map((b) => (
                <g
                  key={b.i}
                  onClick={(e) => {
                    // While a fielder tap is pending the bases are just part of the
                    // field: a ball up the middle lands on second, which sits dead
                    // centre. Swallowing that tap left the scorer pressing a spot
                    // that did nothing, so let it fall through to onField instead.
                    if (g.pending) return;
                    e.stopPropagation();
                    if (scoring) set(E.moveRunner(g, b.i - 1));
                  }}
                  style={cssx('', {
                    cursor: !scoring ? 'default' : g.pending ? 'crosshair' : 'pointer',
                  })}
                >
                  <rect
                    x={b.rx}
                    y={b.ry}
                    width="6.5"
                    height="6.5"
                    transform={b.rot}
                    fill={b.fill}
                    stroke="#111"
                    strokeWidth=".8"
                  />
                </g>
              ))}
            </svg>

            {bases.map((b) => (
              <div
                key={b.i}
                style={cssx(
                  "position:absolute;transform:translate(-50%,0);pointer-events:none;font:700 12px 'IBM Plex Mono',monospace;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap",
                  { left: b.pctX, top: b.pctY },
                )}
              >
                {b.name}
              </div>
            ))}

            {g.pending && (
              <div
                style={css(
                  // The banner sits over deep outfield, which is a real place a ball goes.
                  // It is a label, so let taps through it and keep Cancel clickable.
                  "position:absolute;left:12px;right:12px;top:12px;pointer-events:none;background:#FFC400;color:#111111;padding:10px 14px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;gap:10px;font:600 14px 'IBM Plex Sans',sans-serif",
                )}
              >
                <span>{E.LABEL[g.pending.outcome]} — tap where the ball went</span>
                <button
                  type="button"
                  onClick={() => set(E.cancelPending(g))}
                  style={css(
                    "pointer-events:auto;border:0;background:#111;color:#fff;border-radius:3px;padding:7px 12px;font:600 13px 'IBM Plex Sans',sans-serif",
                  )}
                >
                  Cancel
                </button>
              </div>
            )}

            {!inP && (
              <div
                style={css(
                  'position:absolute;inset:0;background:rgba(17,17,17,.82);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:20px',
                )}
              >
                <span style={css("font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.12em;color:#FFC400")}>
                  FINAL
                </span>
                <span style={css("font:700 56px/1 'IBM Plex Mono',monospace")}>
                  {g.score.us}–{g.score.them}
                </span>
                <span style={css('font-size:14px;color:#CCC')}>
                  {`${g.score.us > g.score.them ? 'W' : g.score.us < g.score.them ? 'L' : 'T'} vs ${g.opp} · ${line.hitsUs} H · ${line.errUs} E`}
                </span>
                <div style={css('display:flex;gap:8px;flex-wrap:wrap;justify-content:center')}>
                  <button
                    type="button"
                    onClick={() => nav.openGame(g.id)}
                    style={css(
                      "min-height:48px;padding:0 20px;border:0;border-radius:4px;background:#FFC400;color:#111111;font:600 15px 'IBM Plex Sans',sans-serif",
                    )}
                  >
                    View recap
                  </button>
                  {scoring && (
                    <button
                      type="button"
                      onClick={() => set({ ...g, status: 'in_progress' })}
                      style={css(
                        "min-height:48px;padding:0 20px;border:1.5px solid #fff;border-radius:4px;background:transparent;color:#fff;font:600 15px 'IBM Plex Sans',sans-serif",
                      )}
                    >
                      Reopen game
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            style={css(
              "display:flex;justify-content:space-between;align-items:center;gap:10px;font:500 13px 'IBM Plex Mono',monospace;color:var(--muted)",
            )}
          >
            <span style={css('text-wrap:pretty')}>{last}</span>
            {scoring && (
              <span style={css('white-space:nowrap;color:var(--muted3)')}>tap a runner to advance</span>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div style={css('display:flex;flex-direction:column;gap:8px;min-width:0')}>
          <SideTabs scoring={scoring} />

          {scoring && nav.side === 'score' && (
            <>
              {showGrid && (
                <>
                  <SectionLabel pad="4px">HITS</SectionLabel>
                  <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:6px')}>
                    {E.OUTCOMES.hits.map(mkKey).map((o) => (
                      <PressKey
                        key={o.code}
                        onClick={o.onTap}
                        base={`min-height:${KEY_H};border:1.5px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 20px 'IBM Plex Mono',monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px`}
                        active="background:#FFC400;color:#111111"
                      >
                        <span>{o.code}</span>
                        <span style={css("font:400 10px 'IBM Plex Sans',sans-serif;color:inherit;opacity:.7")}>
                          {o.label}
                        </span>
                      </PressKey>
                    ))}
                  </div>

                  <SectionLabel pad="2px">ON BASE</SectionLabel>
                  <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:6px')}>
                    {E.OUTCOMES.onBase.map(mkKey).map((o) => (
                      <PressKey
                        key={o.code}
                        onClick={o.onTap}
                        base={`min-height:${KEY_H};border:1.5px solid var(--muted3);border-radius:4px;background:var(--card);font:600 20px 'IBM Plex Mono',monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px`}
                        active="background:#FFC400;color:#111111"
                      >
                        <span>{o.code}</span>
                        <span style={css("font:400 10px 'IBM Plex Sans',sans-serif;color:inherit;opacity:.7")}>
                          {o.short}
                        </span>
                      </PressKey>
                    ))}
                    {/* Tally keys sit in the same row so the grid keeps its shape, but
                        they are drawn dashed and muted: tapping one records the event
                        and changes nothing else on the field. */}
                    {E.OUTCOMES.tally.map(mkKey).map((o) => (
                      <PressKey
                        key={o.code}
                        onClick={o.onTap}
                        title={`${E.LABEL[o.code]} — recorded for the season, no base awarded`}
                        base={`min-height:${KEY_H};border:1.5px dashed var(--muted3);border-radius:4px;background:transparent;color:var(--muted2);font:600 20px 'IBM Plex Mono',monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px`}
                        active="background:var(--muted3);color:#111111"
                      >
                        <span>{o.code}</span>
                        <span style={css("font:400 10px 'IBM Plex Sans',sans-serif;color:inherit;opacity:.7")}>
                          {o.short}
                        </span>
                      </PressKey>
                    ))}
                  </div>

                  <SectionLabel pad="2px">OUTS</SectionLabel>
                  <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:6px')}>
                    {E.OUTCOMES.outs.map(mkKey).map((o) => (
                      <PressKey
                        key={o.code}
                        onClick={o.onTap}
                        base={`min-height:${KEY_H};padding:0;border:1.5px solid var(--line-strong);border-radius:4px;background:#111;color:#fff;font:600 18px 'IBM Plex Mono',monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px`}
                        active="background:#444"
                      >
                        <span>{o.code}</span>
                        <span style={css("font:400 10px 'IBM Plex Sans',sans-serif;color:#BBB")}>{o.short}</span>
                      </PressKey>
                    ))}
                    <button
                      type="button"
                      onClick={() => set(E.undo(g))}
                      style={cssx(
                        "border:1.5px solid var(--line-strong);border-radius:4px;background:#FFC400;color:#111111;font:600 14px 'IBM Plex Sans',sans-serif",
                        { minHeight: KEY_H },
                      )}
                    >
                      ↶ Undo
                    </button>
                  </div>
                </>
              )}

              {oppAuto && (
                <div
                  style={css(
                    'display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;background:var(--card2);border:1px solid var(--line);border-radius:4px',
                  )}
                >
                  <span style={css("font:500 12px 'IBM Plex Mono',monospace;color:var(--muted)")}>
                    Opp. order · next: {oppLabel(oppL[((g.oppIdx || 0) + 1) % oppL.length])}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      patchGame(g.id, {
                        ...g,
                        oppBatter: null,
                        oppIdx: ((g.oppIdx || 0) + 1) % oppL.length,
                      })
                    }
                    style={css(
                      "min-height:32px;padding:0 10px;border:1px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 12px 'IBM Plex Sans',sans-serif",
                    )}
                  >
                    Skip batter
                  </button>
                </div>
              )}

              {needsOpp && (
                <>
                  <SectionLabel pad="4px">OPPOSITION BATTER · JERSEY NUMBER</SectionLabel>
                  <div style={css('display:grid;grid-template-columns:repeat(5,1fr);gap:6px')}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                      <PressKey
                        key={n}
                        onClick={() => setOppEntry((s) => (s + n).slice(0, 2))}
                        base="min-height:54px;border:1.5px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 22px 'IBM Plex Mono',monospace"
                        active="background:#FFC400;color:#111111"
                      >
                        {n}
                      </PressKey>
                    ))}
                  </div>
                  <div style={css('display:flex;justify-content:space-between;align-items:center;gap:8px')}>
                    <span style={css("font:700 32px 'IBM Plex Mono',monospace")}>#{oppEntry || '–'}</span>
                    <span style={css('display:flex;gap:6px')}>
                      <button
                        type="button"
                        onClick={() => setOppEntry('')}
                        style={css(
                          "min-height:46px;padding:0 14px;border:1.5px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 14px 'IBM Plex Sans',sans-serif",
                        )}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!oppEntry) return;
                          set(E.setOppBatter(g, oppEntry));
                          setOppEntry('');
                        }}
                        style={css(
                          "min-height:46px;padding:0 18px;border:1.5px solid var(--line-strong);border-radius:4px;background:#111;color:#fff;font:600 14px 'IBM Plex Sans',sans-serif",
                        )}
                      >
                        Set batter
                      </button>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => set(E.undo(g))}
                    style={css(
                      "min-height:44px;border:1.5px solid var(--line-strong);border-radius:4px;background:#FFC400;color:#111111;font:600 14px 'IBM Plex Sans',sans-serif",
                    )}
                  >
                    ↶ Undo last play
                  </button>
                </>
              )}

              {scoreOnly && (
                <>
                  <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:6px;padding-top:4px')}>
                    <PressKey
                      onClick={() => set(E.scoreOnlyRun(g, 1))}
                      base="min-height:88px;border:1.5px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 24px 'IBM Plex Mono',monospace"
                      active="background:#FFC400;color:#111111"
                    >
                      +1 RUN
                    </PressKey>
                    <PressKey
                      onClick={() => set(E.scoreOnlyOut(g))}
                      base="min-height:88px;border:1.5px solid var(--line-strong);border-radius:4px;background:#111;color:#fff;font:600 24px 'IBM Plex Mono',monospace"
                      active="background:#444"
                    >
                      +1 OUT
                    </PressKey>
                  </div>
                  <button
                    type="button"
                    onClick={() => set(E.undo(g))}
                    style={css(
                      "min-height:48px;border:1.5px solid var(--line-strong);border-radius:4px;background:#FFC400;color:#111111;font:600 14px 'IBM Plex Sans',sans-serif",
                    )}
                  >
                    ↶ Undo
                  </button>
                  <div style={css('font-size:12px;color:var(--muted);text-wrap:pretty')}>
                    Score-only mode: no positioning data is collected for the opposition this half.
                  </div>
                </>
              )}

              {oppTurn && (
                <div
                  style={css(
                    "display:grid;grid-template-columns:1fr 1fr;gap:4px;font:600 12px 'IBM Plex Sans',sans-serif;padding-top:4px",
                  )}
                >
                  <ModeKey on={g.mode === 'full'} onClick={() => set(E.setMode(g, 'full'))}>
                    Full detail
                  </ModeKey>
                  <ModeKey on={g.mode === 'score_only'} onClick={() => set(E.setMode(g, 'score_only'))}>
                    Score only
                  </ModeKey>
                </div>
              )}

              <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:6px;padding-top:6px')}>
                <button
                  type="button"
                  onClick={() => set(E.endHalf(g))}
                  style={css(
                    "min-height:44px;border:1px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 13px 'IBM Plex Sans',sans-serif",
                  )}
                >
                  End half
                </button>
                <button
                  type="button"
                  onClick={() => set(E.endGame(g))}
                  style={css(
                    "min-height:44px;border:1px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 13px 'IBM Plex Sans',sans-serif",
                  )}
                >
                  End game
                </button>
              </div>
            </>
          )}

          {nav.side === 'lineup' && (
            <LineupPanel game={g} finals={finals} current={us && inP ? bIdx : -1} />
          )}

          {scoring && nav.side === 'manager' && (
            <ManagerPanel game={g} set={set} current={bIdx} batterUpper={(us && inP ? pname(bId) : 'BATTER').toUpperCase()} />
          )}
        </div>
      </div>
    </div>
  );
}

function SideTabs({ scoring }: { scoring: boolean }) {
  const nav = useNav();
  const tabs: { key: SidePanel; label: string }[] = scoring
    ? [
        { key: 'score', label: 'Score' },
        { key: 'lineup', label: 'Lineup' },
        { key: 'manager', label: 'Manager' },
      ]
    : [{ key: 'lineup', label: 'Lineup' }];

  // A viewer only ever sees the lineup, so make sure that is what is selected.
  useEffect(() => {
    if (!scoring && nav.side !== 'lineup') nav.setSide('lineup');
  }, [scoring, nav]);

  return (
    <div
      style={cssx("display:grid;gap:4px;font:600 13px 'IBM Plex Sans',sans-serif", {
        gridTemplateColumns: `repeat(${tabs.length},1fr)`,
      })}
    >
      {tabs.map((t) => {
        const on = nav.side === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => nav.setSide(t.key)}
            aria-pressed={on}
            style={cssx('min-height:40px;border:1.5px solid var(--line-strong);border-radius:4px', {
              background: on ? '#111' : 'var(--card)',
              color: on ? '#fff' : 'var(--ink)',
            })}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ModeKey({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={cssx('min-height:38px;border:1.5px solid var(--line-strong);border-radius:4px', {
        background: on ? '#111' : 'var(--card)',
        color: on ? '#fff' : 'var(--ink)',
      })}
    >
      {children}
    </button>
  );
}

function LineupPanel({ game, finals, current }: { game: Game; finals: Game[]; current: number }) {
  const { pname, pnum } = useScorebook();
  return (
    <>
      <div style={css('background:var(--card);border:1.5px solid var(--line-strong);border-radius:4px;overflow:hidden')}>
        <div
          style={css(
            "display:grid;grid-template-columns:28px 40px 1fr auto auto;gap:8px;padding:8px 12px;background:#111;color:#AAA;font:500 11px 'IBM Plex Mono',monospace",
          )}
        >
          <span>#</span>
          <span>NO</span>
          <span>PLAYER</span>
          <span>TODAY</span>
          <span>AVG</span>
        </div>
        {game.lineup.map((id, i) => {
          const today = S.batting([game], id);
          const season = S.batting(finals, id);
          const cur = i === current;
          return (
            <div
              key={id + i}
              style={cssx(
                'display:grid;grid-template-columns:28px 40px 1fr auto auto;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid var(--line);font-size:14px',
                { background: cur ? '#111' : 'var(--card)', color: cur ? '#fff' : 'var(--ink)' },
              )}
            >
              <span
                style={cssx("font:600 13px 'IBM Plex Mono',monospace", {
                  color: cur ? '#FFC400' : 'var(--muted2)',
                })}
              >
                {i + 1}
              </span>
              <span style={css("font:600 13px 'IBM Plex Mono',monospace")}>{pnum(id)}</span>
              <span style={css('font-weight:500')}>{pname(id)}</span>
              <span style={css("font:500 13px 'IBM Plex Mono',monospace")}>
                {today.pa ? `${today.h}-${today.ab}` : '—'}
              </span>
              <span
                style={cssx("font:500 13px 'IBM Plex Mono',monospace", {
                  color: cur ? '#FFC400' : 'var(--muted2)',
                })}
              >
                {season.ab ? S.fmt3(season.avg) : '—'}
              </span>
            </div>
          );
        })}
      </div>
      <div style={css('font-size:12px;color:var(--muted)')}>
        TODAY = hits-at bats this game. AVG is season to date.
      </div>
    </>
  );
}

function ManagerPanel({
  game,
  set,
  current,
  batterUpper,
}: {
  game: Game;
  set: (g: Game) => void;
  current: number;
  batterUpper: string;
}) {
  const { data, pname } = useScorebook();
  const bId = game.lineup[current];
  const bench = data.roster.filter((p) => !game.lineup.includes(p.id));
  const moves = game.log
    .filter((l) => l.manager)
    .map((l) => `${l.half === 'top' ? '▲' : '▼'}${l.inning} · ${(l as { note: string }).note}`);

  return (
    <>
      <div
        style={css(
          'background:#111;color:#fff;border-radius:4px;padding:14px 16px;display:flex;flex-direction:column;gap:6px',
        )}
      >
        <span style={css("font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.1em;color:#FFC400")}>
          MANAGER MODE
        </span>
        <span style={css('font-size:13px;line-height:1.5;color:#CCC;text-wrap:pretty')}>
          Moves apply from the next plate appearance and are written to the game log.
        </span>
      </div>

      <SectionLabel pad="4px">PINCH HITTER FOR {batterUpper}</SectionLabel>
      {!bench.length && (
        <div style={css('font-size:13px;color:var(--muted)')}>
          No bench players. Add players in Manage → Roster and leave them out of the lineup.
        </div>
      )}
      <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px')}>
        {bench.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              const l = [...game.lineup];
              l[current] = p.id;
              set(E.managerMove(game, `${p.name} pinch hits for ${pname(bId)} (${current + 1})`, l));
            }}
            style={css(
              "min-height:48px;border:1.5px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 14px 'IBM Plex Sans',sans-serif;display:flex;align-items:center;gap:8px;padding:0 12px",
            )}
          >
            <span style={css("font:600 13px 'IBM Plex Mono',monospace;color:var(--muted2)")}>#{p.num}</span>
            {p.name}
          </button>
        ))}
      </div>

      <SectionLabel pad="8px">REORDER BATTING ORDER</SectionLabel>
      <div style={css('background:var(--card);border:1.5px solid var(--line-strong);border-radius:4px;overflow:hidden')}>
        {game.lineup.map((id, i) => {
          const cur = i === current;
          return (
            <div
              key={id + i}
              style={cssx(
                'display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;padding:6px 12px;border-top:1px solid var(--line);font-size:14px',
                { background: cur ? '#111' : 'var(--card)', color: cur ? '#fff' : 'var(--ink)' },
              )}
            >
              <span
                style={cssx("font:600 13px 'IBM Plex Mono',monospace", {
                  color: cur ? '#FFC400' : 'var(--muted2)',
                })}
              >
                {i + 1}
              </span>
              <span style={css('font-weight:500')}>{pname(id)}</span>
              <span style={css('display:flex;gap:4px')}>
                <Nudge
                  onClick={() => {
                    if (i === 0) return;
                    const l = [...game.lineup];
                    [l[i - 1], l[i]] = [l[i], l[i - 1]];
                    set(E.managerMove(game, `${pname(id)} moved up to ${i}`, l));
                  }}
                >
                  ↑
                </Nudge>
                <Nudge
                  onClick={() => {
                    if (i === game.lineup.length - 1) return;
                    const l = [...game.lineup];
                    [l[i + 1], l[i]] = [l[i], l[i + 1]];
                    set(E.managerMove(game, `${pname(id)} moved down to ${i + 2}`, l));
                  }}
                >
                  ↓
                </Nudge>
              </span>
            </div>
          );
        })}
      </div>

      <SectionLabel pad="8px">GAME CLOCK</SectionLabel>
      <div
        style={css(
          'display:flex;justify-content:space-between;align-items:center;background:var(--card);border:1.5px solid var(--line-strong);border-radius:4px;padding:12px 14px',
        )}
      >
        <span style={css("font:700 28px 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums")}>
          {E.timeLeft(game)}
        </span>
        <span style={css('display:flex;gap:6px;align-items:center')}>
          <span style={css('font-size:12px;color:var(--muted)')}>{game.timeLimitMins} min limit</span>
          <Nudge onClick={() => set({ ...game, timeLimitMins: Math.max(5, game.timeLimitMins - 5) })}>
            −
          </Nudge>
          <Nudge onClick={() => set({ ...game, timeLimitMins: game.timeLimitMins + 5 })}>+</Nudge>
        </span>
      </div>

      <SectionLabel pad="8px">MOVES THIS GAME</SectionLabel>
      {!moves.length && <div style={css('font-size:13px;color:var(--muted)')}>None yet.</div>}
      <div style={css('display:flex;flex-direction:column;gap:4px')}>
        {moves.map((m, i) => (
          <div key={i} style={css("font:500 13px 'IBM Plex Mono',monospace;color:var(--ink)")}>
            {m}
          </div>
        ))}
      </div>
    </>
  );
}

function Nudge({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={css(
        'width:40px;height:36px;border:1px solid var(--muted3);border-radius:4px;background:var(--card);font-size:14px',
      )}
    >
      {children}
    </button>
  );
}

function NoGame() {
  const nav = useNav();
  return (
    <div
      style={css(
        'padding:40px 20px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center',
      )}
    >
      <div style={css("font:600 18px 'IBM Plex Sans',sans-serif")}>No game in progress</div>
      <div style={css('font-size:14px;color:var(--muted);max-width:360px;text-wrap:pretty')}>
        Set up a new game from Today. The last game's recap is under Games.
      </div>
      <button
        type="button"
        onClick={() => nav.go('today')}
        style={css(
          "min-height:48px;padding:0 22px;border:0;border-radius:4px;background:#111;color:#fff;font:600 15px 'IBM Plex Sans',sans-serif",
        )}
      >
        Go to Today
      </button>
    </div>
  );
}
