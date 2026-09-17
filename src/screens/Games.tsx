import { useState } from 'react';
import * as E from '../engine/scoring.js';
import * as S from '../engine/stats.js';
import * as A from '../engine/analysis.js';
import { css, cssx } from '../lib/css';
import type { Game, LogEntry, ManagerLog, PlayLog, ScoreOnlyLog } from '../lib/types';
import { ChromiesLabel, Wordmark } from '../components/Wordmark';
import { SprayField } from '../components/Field';
import { ResultRow } from '../components/ResultRow';
import { SectionLabel } from '../components/ui';
import { useNav } from '../state/nav';
import { can } from '../state/roles';
import { useScorebook } from '../state/store';

export function Games() {
  const { data } = useScorebook();
  const nav = useNav();
  const selected = data.games.find((g) => g.id === nav.gameId);
  return selected ? <Recap game={selected} /> : <GamesList />;
}

function GamesList() {
  const { data } = useScorebook();
  const finals = data.games.filter((g) => g.status === 'final').sort((a, b) => b.date - a.date);
  return (
    <div
      style={css(
        'padding:20px;display:flex;flex-direction:column;gap:10px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box',
      )}
    >
      <SectionLabel>{finals.length} GAMES</SectionLabel>
      {!finals.length && (
        <div
          style={css(
            'background:var(--card);border-radius:6px;padding:18px;font-size:14px;color:var(--muted);line-height:1.5',
          )}
        >
          No completed games yet.
        </div>
      )}
      <div style={css('display:flex;flex-direction:column;gap:6px')}>
        {finals.map((g) => (
          <ResultRow key={g.id} game={g} showInnings />
        ))}
      </div>
    </div>
  );
}

function Recap({ game: g }: { game: Game }) {
  const { data, save, pname, pnum, fmtDate, role } = useScorebook();
  const nav = useNav();
  const [copied, setCopied] = useState('');

  const line = S.lineScore(g, 5);
  const analysis = A.gameAnalysis(g, data.roster, data.games);
  const top = S.topPerformers(g).map((p) => ({
    id: p.name,
    num: pnum(p.name),
    name: pname(p.name),
    line: `${p.h}-${p.ab}${p.rbi ? ', ' + p.rbi + ' RBI' : ''}${p.bb ? ', ' + p.bb + ' BB' : ''}`,
  }));
  const potg = top[0] ? `${top[0].name} · ${top[0].line}` : '';
  const status = g.status === 'final' ? 'FINAL' : 'IN PROGRESS';

  const spray = g.log
    .filter((l): l is PlayLog => !l.manager && !l.scoreOnly && l.fieldX != null && S.usLog(g, l))
    .map((l) => ({ x: l.fieldX!, y: l.fieldY!, fill: S.HITS.has(l.outcome) ? '#FFFFFF' : '#111111' }));

  const summary =
    `Chromies ${g.score.us}, ${g.opp} ${g.score.them} — ${status === 'FINAL' ? 'Final' : 'In progress'} ` +
    `(${fmtDate(g.date)}). H ${line.hitsUs}-${line.hitsThem}, E ${line.errUs}-${line.errThem}.` +
    `${potg ? ' Player of the game: ' + potg + '.' : ''}`;

  const copySummary = () => {
    void navigator.clipboard?.writeText(summary);
    setCopied('Copied.');
    setTimeout(() => setCopied(''), 1500);
  };

  const deleteGame = () => {
    if (!confirm('Delete this game? This cannot be undone.')) return;
    save({
      ...data,
      games: data.games.filter((x) => x.id !== g.id),
      activeId: data.activeId === g.id ? null : data.activeId,
    });
    nav.openGame(null);
  };

  return (
    <div
      style={css(
        'padding:20px;display:flex;flex-direction:column;gap:18px;max-width:900px;width:100%;margin:0 auto;box-sizing:border-box',
      )}
    >
      <button
        type="button"
        onClick={() => nav.openGame(null)}
        style={css(
          "align-self:flex-start;border:0;background:none;padding:0;font:600 13px 'IBM Plex Mono',monospace;color:var(--ink)",
        )}
      >
        ‹ GAMES
      </button>

      <div
        style={css(
          'background:#111;color:#fff;border-radius:6px;padding:16px 20px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px 24px',
        )}
      >
        <div style={css('display:flex;flex-direction:column;gap:4px')}>
          <span style={css("font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.1em;color:#FFC400")}>
            {status} · {fmtDate(g.date)}
          </span>
          <span style={css("font:700 40px/1 'IBM Plex Mono',monospace")}>
            {g.score.us}–{g.score.them}{' '}
            <span style={css("font:600 18px 'IBM Plex Sans',sans-serif;color:#AAA")}>vs {g.opp}</span>
          </span>
        </div>
        <table
          style={css("border-collapse:collapse;font:500 13px 'IBM Plex Mono',monospace;white-space:nowrap")}
        >
          <thead>
            <tr style={css('color:#888;font-size:11px')}>
              <th style={css('text-align:left;padding:0 10px 4px 0;font-weight:500')} />
              {line.innings.map((n) => (
                <th key={n} style={css('padding:0 6px 4px;font-weight:500')}>
                  {n}
                </th>
              ))}
              <th style={css('padding:0 6px 4px 16px;font-weight:600;color:#fff')}>R</th>
              <th style={css('padding:0 6px 4px;font-weight:500')}>H</th>
              <th style={css('padding:0 6px 4px;font-weight:500')}>E</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={css("padding:2px 10px 2px 0;font-family:'IBM Plex Sans',sans-serif;font-weight:600")}>
                <ChromiesLabel />
              </td>
              {line.us.map((c, i) => (
                <td key={i} style={css('padding:2px 6px;text-align:center')}>
                  {c.v}
                </td>
              ))}
              <td style={css('padding:2px 6px 2px 16px;text-align:center;font-weight:700;background:#FFC400;color:#111111')}>
                {g.score.us}
              </td>
              <td style={css('padding:2px 6px;text-align:center')}>{line.hitsUs}</td>
              <td style={css('padding:2px 6px;text-align:center')}>{line.errUs}</td>
            </tr>
            <tr>
              <td style={css("padding:2px 10px 2px 0;font-family:'IBM Plex Sans',sans-serif;font-weight:600;color:#AAA")}>
                {g.opp}
              </td>
              {line.them.map((c, i) => (
                <td key={i} style={css('padding:2px 6px;text-align:center')}>
                  {c.v}
                </td>
              ))}
              <td style={css('padding:2px 6px 2px 16px;text-align:center;font-weight:700;background:#333')}>
                {g.score.them}
              </td>
              <td style={css('padding:2px 6px;text-align:center')}>{line.hitsThem}</td>
              <td style={css('padding:2px 6px;text-align:center')}>{line.errThem}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={css(
          'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start',
        )}
      >
        <div style={css('display:flex;flex-direction:column;gap:8px')}>
          <SectionLabel>TOP PERFORMERS</SectionLabel>
          <div style={css('background:var(--card);border-radius:6px;overflow:hidden')}>
            {top.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => nav.openPlayer(p.id)}
                style={css(
                  'width:100%;border:0;border-top:1px solid var(--line);background:var(--card);padding:12px 14px;display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;text-align:left',
                )}
              >
                <span style={css("font:700 18px 'IBM Plex Mono',monospace;color:var(--muted2)")}>{p.num}</span>
                <span style={css('font-weight:600;font-size:14px')}>{p.name}</span>
                <span style={css("font:500 13px 'IBM Plex Mono',monospace")}>{p.line}</span>
              </button>
            ))}
          </div>

          <SectionLabel pad="8px">BALLS IN PLAY · CHROMIES</SectionLabel>
          <SprayField dots={spray} r={1.8} />
          <div style={css('font-size:12px;color:var(--muted)')}>○ hit · ● out</div>
        </div>

        <div style={css('display:flex;flex-direction:column;gap:8px')}>
          <div style={css('display:flex;justify-content:space-between;align-items:baseline')}>
            <SectionLabel>PLAY BY PLAY</SectionLabel>
            <span style={css("font:500 11px 'IBM Plex Mono',monospace;color:var(--muted3)")}>
              {g.log.filter((l) => !l.manager).length} plays
            </span>
          </div>
          <div
            style={css(
              'background:var(--card);border-radius:6px;overflow:hidden;max-height:520px;overflow-y:auto',
            )}
          >
            {[...g.log].reverse().map((l, i) => (
              <PlayRow key={i} game={g} entry={l} pname={pname} />
            ))}
          </div>
        </div>
      </div>

      <div style={css('display:flex;flex-direction:column;gap:8px')}>
        <div style={css('display:flex;justify-content:space-between;align-items:baseline')}>
          <SectionLabel>GAME ANALYSIS</SectionLabel>
          <span style={css("font:500 11px 'IBM Plex Mono',monospace;color:var(--muted3)")}>
            written from the log
          </span>
        </div>
        <div
          style={css(
            'background:#111;color:#fff;border-radius:6px;padding:18px 20px;display:flex;flex-direction:column;gap:14px',
          )}
        >
          <div style={css("font:600 20px/1.3 'IBM Plex Sans',sans-serif;text-wrap:pretty")}>
            {analysis.headline}
          </div>
          <div
            style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px')}
          >
            <AnalysisColumn title="AT THE PLATE" lines={analysis.summary} />
            <AnalysisColumn title="HOW IT TURNED" lines={analysis.turning} />
            <AnalysisColumn title="WHO DELIVERED" lines={analysis.performers} />
            <AnalysisColumn title="IN THE FIELD" lines={analysis.defense} />
          </div>
        </div>
      </div>

      <div style={css('display:flex;flex-direction:column;gap:8px')}>
        <SectionLabel>SHARE CARD</SectionLabel>
        <div style={css('display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start')}>
          <div
            style={css(
              'width:360px;max-width:100%;aspect-ratio:1;background:#111;color:#fff;border-radius:6px;padding:26px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px',
            )}
          >
            <div style={css('display:flex;justify-content:space-between;align-items:center')}>
              <Wordmark />
              <span style={css("font:600 11px 'IBM Plex Mono',monospace;color:#AAA")}>
                {status} · {fmtDate(g.date, true)}
              </span>
            </div>
            <div
              style={css(
                "margin-top:auto;display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px 16px;font:600 22px 'IBM Plex Sans',sans-serif",
              )}
            >
              <span>
                <ChromiesLabel />
              </span>
              <span style={css("font:700 64px/.9 'IBM Plex Mono',monospace;color:#FFC400")}>
                {g.score.us}
              </span>
              <span style={css('color:#AAA')}>{g.opp}</span>
              <span style={css("font:700 64px/.9 'IBM Plex Mono',monospace;color:#AAA")}>
                {g.score.them}
              </span>
            </div>
            <div style={css("font:500 13px 'IBM Plex Sans',sans-serif;color:#CCC")}>
              {potg ? 'Player of the game · ' + potg : ''}
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <button
              type="button"
              onClick={copySummary}
              style={css(
                "min-height:44px;padding:0 16px;border:1.5px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 13px 'IBM Plex Sans',sans-serif",
              )}
            >
              Copy text summary
            </button>
            {can(role, 'deleteGame') && (
              <button
                type="button"
                onClick={deleteGame}
                style={css(
                  "min-height:44px;padding:0 16px;border:1.5px solid var(--muted3);border-radius:4px;background:var(--card);color:var(--muted);font:600 13px 'IBM Plex Sans',sans-serif",
                )}
              >
                Delete game
              </button>
            )}
            <span style={css('font-size:12px;color:var(--muted2)')}>{copied}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalysisColumn({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div style={css('display:flex;flex-direction:column;gap:6px')}>
      <span style={css("font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.1em;color:#FFC400")}>
        {title}
      </span>
      {lines.map((t, i) => (
        <div key={i} style={css('font-size:14px;line-height:1.5;color:#DDD;text-wrap:pretty')}>
          {t}
        </div>
      ))}
    </div>
  );
}

function PlayRow({
  game: g,
  entry: l,
  pname,
}: {
  game: Game;
  entry: LogEntry;
  pname: (id: string) => string;
}) {
  const usSide = (l.half === 'top') === g.weBatFirst;
  const inn = `${l.half === 'top' ? '▲' : '▼'}${l.inning}`;

  let text: string;
  let runs = '';
  let bg = 'var(--card)';
  let fg = 'var(--ink)';

  if (l.manager) {
    text = 'Manager: ' + (l as ManagerLog).note;
    bg = 'var(--card2)';
    fg = 'var(--muted)';
  } else if (l.scoreOnly) {
    text = (usSide ? 'Chromies' : g.opp) + ' run (score only)';
    runs = '+' + (l as ScoreOnlyLog).runs;
  } else {
    const p = l as PlayLog;
    const attrs = p.attr && Object.keys(p.attr).length
      ? ' (' + Object.entries(p.attr).map(([k, v]) => k + ':' + v).join(' ') + ')'
      : '';
    text =
      `${usSide ? pname(p.batter) : g.opp + ' #' + (p.batter || '').replace('#', '')} — ` +
      `${E.LABEL[p.outcome]}${p.fielder ? ' to ' + p.fielder : ''}${attrs}`;
    runs = p.runs.length ? '+' + p.runs.length : '';
    if (!usSide) {
      bg = 'var(--card2)';
      fg = 'var(--muted)';
    }
  }

  return (
    <div
      style={cssx(
        'display:grid;grid-template-columns:44px 1fr auto;gap:10px;padding:9px 14px;border-top:1px solid var(--line);font-size:13px',
        { background: bg },
      )}
    >
      <span style={css("font:600 12px 'IBM Plex Mono',monospace;color:var(--muted2)")}>{inn}</span>
      <span style={cssx('', { color: fg })}>{text}</span>
      <span style={css("font:600 12px 'IBM Plex Mono',monospace;color:#6B4A00")}>{runs}</span>
    </div>
  );
}
