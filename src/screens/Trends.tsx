import * as S from '../engine/stats.js';
import { css, cssx } from '../lib/css';
import type { Game, PlayLog, RangeKey, ScoreOnlyLog, SprayFilter } from '../lib/types';
import { applyRange, RANGE_TABS, rangeTitle } from '../lib/ranges';
import { SprayField } from '../components/Field';
import { BinderFrame, BinderLayout, BinderTabs, ContactBars, SectionLabel } from '../components/ui';
import { useNav } from '../state/nav';
import { useScorebook } from '../state/store';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const ordinal = (i: number) => ORDINALS[i] ?? `${i + 1}th`;
const pct = (v: number) => Math.round(v * 100) + '%';

const CARD = 'background:var(--card);border-radius:6px;padding:16px;display:flex;flex-direction:column;gap:12px';
const CARD_HEAD = 'display:flex;justify-content:space-between;align-items:baseline';
const CARD_TITLE = "font:600 15px 'IBM Plex Sans',sans-serif";
const CARD_VALUE = "font:700 22px 'IBM Plex Mono',monospace";
const DETAIL =
  "min-height:20px;display:flex;justify-content:space-between;align-items:center;gap:10px;font:500 12px 'IBM Plex Mono',monospace;color:var(--muted)";

type FmtDate = (t: number, short?: boolean) => string;

export function Trends() {
  const { data, fmtDate } = useScorebook();
  const nav = useNav();

  const finals = data.games.filter((g) => g.status === 'final');
  const chron = applyRange(finals, nav.trRange);
  const teamAvg = S.teamBatting(chron);

  return (
    <div
      style={css(
        'padding:20px;display:flex;flex-direction:column;gap:16px;max-width:940px;width:100%;margin:0 auto;box-sizing:border-box',
      )}
    >
      <BinderLayout>
        <BinderTabs tabs={RANGE_TABS} active={nav.trRange} onPick={(k) => nav.setTrRange(k as RangeKey)} />
        <BinderFrame gap={16}>
          <SectionLabel>
            TRENDS · {rangeTitle(nav.trRange)} · {chron.length} GAMES
          </SectionLabel>

          {!chron.length && (
            <div
              style={css(
                'background:var(--card);border-radius:6px;padding:18px;font-size:14px;color:var(--muted);line-height:1.5',
              )}
            >
              No completed games in this range.
            </div>
          )}

          {!!chron.length && (
            <div
              style={css(
                'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start',
              )}
            >
              <RunDifferential
                games={chron}
                fmtDate={fmtDate}
                pick={nav.trPick}
                onPick={nav.setTrPick}
                onOpen={nav.openGame}
              />
              <RunningAverage
                games={chron}
                avg={S.fmt3(teamAvg.avg)}
                fmtDate={fmtDate}
                pick={nav.trAvgPick}
                onPick={nav.setTrAvgPick}
                onOpen={nav.openGame}
              />
              <WhereWeHitIt games={chron} filter={nav.sprayFilter} onFilter={nav.setSprayFilter} />
              <RunsByInning games={chron} />
            </div>
          )}
        </BinderFrame>
      </BinderLayout>
    </div>
  );
}

function RunDifferential({
  games,
  fmtDate,
  pick,
  onPick,
  onOpen,
}: {
  games: Game[];
  fmtDate: FmtDate;
  pick: string | null;
  onPick: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const diffs = games.map((g) => g.score.us - g.score.them);
  const mx = Math.max(1, ...diffs.map(Math.abs));
  const total = diffs.reduce((a, b) => a + b, 0);
  const picked = games.find((g) => g.id === pick) ?? null;

  return (
    <div style={css(CARD)}>
      <div style={css(CARD_HEAD)}>
        <span style={css(CARD_TITLE)}>Run differential by game</span>
        <span style={css(CARD_VALUE)}>
          {total >= 0 ? '+' : ''}
          {total}
        </span>
      </div>
      <div
        style={cssx('gap:5px;height:140px;position:relative;display:grid', {
          gridTemplateColumns: `repeat(${Math.max(1, games.length)},1fr)`,
        })}
      >
        <div style={css('position:absolute;left:0;right:0;top:50%;border-top:1px solid var(--line)')} />
        {games.map((g, i) => {
          const d = diffs[i];
          const on = pick === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(on ? null : g.id)}
              title={`${fmtDate(g.date)} · Chromies ${g.score.us}, ${g.opp} ${g.score.them} (${d >= 0 ? '+' : ''}${d})`}
              style={cssx(
                'height:100%;display:flex;flex-direction:column;border:0;padding:0;border-radius:3px;cursor:pointer',
                {
                  justifyContent: d >= 0 ? 'flex-start' : 'flex-end',
                  background: on ? 'var(--line)' : 'transparent',
                },
              )}
            >
              <div
                style={cssx('height:50%;display:flex;flex-direction:column', {
                  justifyContent: d >= 0 ? 'flex-end' : 'flex-start',
                })}
              >
                <div
                  style={cssx('border-radius:2px', {
                    background: d >= 0 ? 'var(--ink)' : 'var(--muted3)',
                    height: Math.round((Math.abs(d) / mx) * 100) + '%',
                    outline: on ? '2px solid #FFC400' : 'none',
                  })}
                />
              </div>
            </button>
          );
        })}
      </div>
      <div style={css(DETAIL)}>
        <span>
          {picked
            ? `${fmtDate(picked.date)} · vs ${picked.opp} · Chromies ${picked.score.us}, ${picked.opp} ${picked.score.them} · ${picked.score.us - picked.score.them >= 0 ? '+' : ''}${picked.score.us - picked.score.them}`
            : 'Tap a bar for the score. Above the line = we outscored them.'}
        </span>
        {picked && <OpenRecap onClick={() => onOpen(picked.id)} />}
      </div>
    </div>
  );
}

function RunningAverage({
  games,
  avg,
  fmtDate,
  pick,
  onPick,
  onOpen,
}: {
  games: Game[];
  avg: string;
  fmtDate: FmtDate;
  pick: string | null;
  onPick: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const pts = games.map((g, i) => {
    const cum = S.teamBatting(games.slice(0, i + 1));
    const x = games.length === 1 ? 150 : (i / (games.length - 1)) * 300;
    const y = 110 - Math.max(0, Math.min(1, (cum.avg - 0.2) / 0.2)) * 100;
    return { x: Math.round(x), y: Math.round(y), g, cum: cum.avg, game: S.teamBatting([g]), i };
  });
  const picked = pts.find((p) => p.g.id === pick) ?? null;

  return (
    <div style={css(CARD)}>
      <div style={css(CARD_HEAD)}>
        <span style={css(CARD_TITLE)}>Team AVG, running</span>
        <span style={css(CARD_VALUE)}>{avg}</span>
      </div>
      <svg viewBox="0 0 300 120" style={css('width:100%;display:block')}>
        {[110, 60, 10].map((y) => (
          <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="var(--line)" />
        ))}
        {[
          { y: 8, label: '.400' },
          { y: 58, label: '.300' },
          { y: 108, label: '.200' },
        ].map((t) => (
          <text
            key={t.label}
            x="0"
            y={t.y}
            style={css("font:500 8px 'IBM Plex Mono',monospace;fill:var(--muted3)")}
          >
            {t.label}
          </text>
        ))}
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => {
          const on = pick === p.g.id;
          return (
            <g key={p.g.id} onClick={() => onPick(on ? null : p.g.id)} style={css('cursor:pointer')}>
              <title>{`Game ${i + 1} · ${fmtDate(p.g.date)} · vs ${p.g.opp} · ${S.fmt3(p.cum)} running`}</title>
              <circle cx={p.x} cy={p.y} r="8" fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={on ? 5 : 3.5}
                fill={on || i === pts.length - 1 ? '#FFC400' : 'var(--card)'}
                stroke={on ? '#FFC400' : '#111'}
                strokeWidth="1.5"
              />
            </g>
          );
        })}
      </svg>
      <div style={css(DETAIL)}>
        <span>
          {picked
            ? `Game ${picked.i + 1} · ${fmtDate(picked.g.date)} · vs ${picked.g.opp} · went ${picked.game.h}-for-${picked.game.ab} (${S.fmt3(picked.game.avg)}) · running AVG ${S.fmt3(picked.cum)}`
            : 'Each point is the team average through that game. Tap one for details.'}
        </span>
        {picked && <OpenRecap onClick={() => onOpen(picked.g.id)} />}
      </div>
    </div>
  );
}

function WhereWeHitIt({
  games,
  filter,
  onFilter,
}: {
  games: Game[];
  filter: SprayFilter;
  onFilter: (f: SprayFilter) => void;
}) {
  const bip: PlayLog[] = [];
  const contact = { GB: 0, FB: 0, LD: 0, PU: 0 };
  for (const g of games) {
    for (const l of g.log) {
      if (!S.usLog(g, l)) continue;
      const p = l as PlayLog;
      if (p.fieldX == null) continue;
      bip.push(p);
      const key = p.contact as keyof typeof contact;
      if (contact[key] != null) contact[key]++;
    }
  }
  const n = bip.length || 1;
  const contactTotal = Object.values(contact).reduce((a, b) => a + b, 0) || 1;
  const dots = bip
    .filter((l) => filter === 'all' || (filter === 'hits') === S.HITS.has(l.outcome))
    .map((l) => ({ x: l.fieldX!, y: l.fieldY!, fill: S.HITS.has(l.outcome) ? '#FFFFFF' : '#111111' }));

  const filters: { key: SprayFilter; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'hits', label: '○ HITS' },
    { key: 'outs', label: '● OUTS' },
  ];

  return (
    <div style={css(CARD)}>
      <div style={css(CARD_HEAD)}>
        <span style={css(CARD_TITLE)}>Where we hit it</span>
        <span style={css('display:flex;align-items:center;gap:8px')}>
          <span style={css('font-size:12px;color:var(--muted)')}>{bip.length} balls in play</span>
          <span
            style={css(
              "display:grid;grid-template-columns:repeat(3,auto);border:1.5px solid var(--line-strong);border-radius:4px;overflow:hidden;font:600 11px 'IBM Plex Mono',monospace",
            )}
          >
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilter(f.key)}
                aria-pressed={filter === f.key}
                style={cssx('min-height:32px;padding:0 10px;border:0', {
                  background: filter === f.key ? '#111' : 'var(--card)',
                  color: filter === f.key ? '#FFC400' : 'var(--ink)',
                })}
              >
                {f.label}
              </button>
            ))}
          </span>
        </span>
      </div>

      <SprayField guides="trends" r={1.5} dots={dots} />

      <div
        style={css(
          "display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font:600 12px 'IBM Plex Mono',monospace;text-align:center",
        )}
      >
        <Zone bg="#111" label="LEFT" value={pct(bip.filter((l) => l.fieldX! < 44).length / n)} />
        <Zone
          bg="#444"
          label="CENTER"
          value={pct(bip.filter((l) => l.fieldX! >= 44 && l.fieldX! <= 56).length / n)}
        />
        <Zone bg="#999" label="RIGHT" value={pct(bip.filter((l) => l.fieldX! > 56).length / n)} />
      </div>

      <div style={css('display:flex;flex-direction:column;gap:8px;padding-top:4px')}>
        <ContactBars
          rows={(['GB', 'FB', 'LD', 'PU'] as const).map((k) => ({
            k,
            v: pct(contact[k] / contactTotal),
            w: pct(contact[k] / contactTotal),
          }))}
        />
      </div>
    </div>
  );
}

function RunsByInning({ games }: { games: Game[] }) {
  const innN = Math.max(...games.map((g) => Math.max(...g.log.map((l) => l.inning), 1)), 5);
  const byUs = Array<number>(innN).fill(0);
  const byThem = Array<number>(innN).fill(0);

  for (const g of games) {
    for (const l of g.log) {
      if (l.manager) continue;
      const runs = l.scoreOnly ? (l as ScoreOnlyLog).runs : (l as PlayLog).runs.length;
      const ours = S.usLog(g, l) || (l.scoreOnly && (l.half === 'top') === g.weBatFirst);
      if (ours) byUs[l.inning - 1] += runs;
      else byThem[l.inning - 1] += runs;
    }
  }

  const mx = Math.max(1, ...byUs.map((u, i) => u + byThem[i]));
  const usTotal = byUs.reduce((a, b) => a + b, 0);
  const themTotal = byThem.reduce((a, b) => a + b, 0);
  const cols = { gridTemplateColumns: `repeat(${innN},1fr)` };

  return (
    <div style={css(CARD)}>
      <span style={css(CARD_TITLE)}>Runs by inning</span>
      <div style={cssx('display:grid;gap:6px;align-items:end;height:140px', cols)}>
        {byUs.map((u, i) => (
          <div
            key={i}
            title={`${ordinal(i)} inning · Chromies ${u}, opponents ${byThem[i]}`}
            style={css('display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:2px')}
          >
            <span style={css("font:700 11px 'IBM Plex Mono',monospace;text-align:center;color:var(--ink)")}>
              {u}
            </span>
            <div
              style={cssx('background:#FFC400;border-radius:2px 2px 0 0', {
                height: Math.round((u / mx) * 80) + '%',
              })}
            />
            <div
              style={cssx('background:#999;border-radius:0 0 2px 2px', {
                height: Math.round((byThem[i] / mx) * 80) + '%',
              })}
            />
            <span style={css("font:500 11px 'IBM Plex Mono',monospace;text-align:center;color:var(--muted)")}>
              {byThem[i]}
            </span>
          </div>
        ))}
      </div>
      <div
        style={cssx(
          "display:grid;gap:6px;font:600 11px 'IBM Plex Mono',monospace;color:var(--muted2);text-align:center;border-top:1px solid var(--line);padding-top:6px",
          cols,
        )}
      >
        {byUs.map((_, i) => (
          <span key={i}>{ordinal(i)}</span>
        ))}
      </div>
      <div style={css('display:flex;gap:16px;font-size:12px;color:var(--muted);flex-wrap:wrap')}>
        <span>
          <span style={css('display:inline-block;width:10px;height:10px;background:#FFC400;vertical-align:-1px')} />{' '}
          Chromies · {usTotal} total
        </span>
        <span>
          <span style={css('display:inline-block;width:10px;height:10px;background:#999;vertical-align:-1px')} />{' '}
          Opponents · {themTotal} total
        </span>
        <span style={css('color:var(--muted3)')}>
          Numbers above the bar are ours, below are theirs; totals across {games.length} games.
        </span>
      </div>
    </div>
  );
}

function OpenRecap({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={css(
        "min-height:28px;padding:0 10px;border:1px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 11px 'IBM Plex Sans',sans-serif;color:var(--ink)",
      )}
    >
      Open recap
    </button>
  );
}

function Zone({ bg, label, value }: { bg: string; label: string; value: string }) {
  return (
    <div style={cssx('color:#fff;padding:14px 6px;border-radius:4px', { background: bg })}>
      {label}
      <br />
      <span style={css('font-size:22px')}>{value}</span>
    </div>
  );
}
