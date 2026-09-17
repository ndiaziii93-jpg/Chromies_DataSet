import { useState, type ChangeEvent } from 'react';
import * as E from '../engine/scoring.js';
import * as S from '../engine/stats.js';
import { css, cssx } from '../lib/css';
import type { OppBatter, Player, Position, ScorebookData, Theme } from '../lib/types';
import { FieldBackdrop } from '../components/Field';
import { BinderFrame, BinderLayout, BinderTabs, Modal, SectionLabel } from '../components/ui';
import { freshData } from '../state/document';
import { useNav } from '../state/nav';
import { can } from '../state/roles';
import { useScorebook } from '../state/store';

const LIMITS = [45, 60, 75, 90];
const ROSTER_GRID =
  'display:grid;grid-template-columns:30px 56px minmax(120px,1fr) 70px 64px 92px 40px;gap:8px';
const OPP_GRID = 'display:grid;grid-template-columns:30px 72px minmax(120px,1fr) 92px 40px;gap:8px';
const HEAD = "padding:10px 14px;background:#111;color:#AAA;font:500 11px 'IBM Plex Mono',monospace";
const NUDGE =
  'width:42px;height:40px;border:1px solid var(--line-strong);border-radius:4px;background:var(--card)';

export function Manage() {
  const { data, save, role } = useScorebook();
  const nav = useNav();
  const [msg, setMsg] = useState('');
  const [posPick, setPosPick] = useState<string | null>(null);

  const editRoster = can(role, 'editRoster');
  const tabs = [
    ...(editRoster ? [{ key: 'us', label: 'Chromies', title: 'Chromies roster' }] : []),
    { key: 'them', label: 'Bad Guys', title: 'Next opponent' },
  ];
  // A scorer only gets Bad Guys, so that is what the frame shows.
  const mgTab = editRoster ? nav.mgTab : 'them';

  const setRoster = (roster: Player[]) => save({ ...data, roster });
  const setOpp = (oppLineup: OppBatter[]) => save({ ...data, oppLineup });
  const picked = data.roster.find((p) => p.id === posPick) ?? null;

  return (
    <div
      style={css(
        'padding:20px;display:flex;flex-direction:column;gap:20px;max-width:940px;width:100%;margin:0 auto;box-sizing:border-box',
      )}
    >
      <BinderLayout>
        <BinderTabs
          tabs={tabs}
          active={mgTab}
          onPick={(k) => nav.setMgTab(k as 'us' | 'them')}
          minHeight={130}
          fontSize={17}
          padding="14px 10px"
        />
        <BinderFrame gap={8}>
          {mgTab === 'us' && editRoster && (
            <RosterTable data={data} setRoster={setRoster} onPickPos={setPosPick} />
          )}
          {mgTab === 'them' && <BadGuys data={data} save={save} setOpp={setOpp} />}
        </BinderFrame>
      </BinderLayout>

      {can(role, 'editSettings') && <Defaults data={data} save={save} />}
      {can(role, 'editData') && <DataPanel data={data} save={save} msg={msg} setMsg={setMsg} />}

      {picked && (
        <PositionPicker
          player={picked}
          roster={data.roster}
          onAssign={(pos) => {
            let roster = data.roster.map((x) => (x.id === picked.id ? { ...x, pos } : x));
            // A fielding spot holds one player: whoever had it moves to EH.
            if (pos !== 'EH' && pos !== 'UT') {
              roster = roster.map((x) =>
                x.id !== picked.id && x.pos === pos ? { ...x, pos: 'EH' as Position } : x,
              );
            }
            setRoster(roster);
            setPosPick(null);
          }}
          onClose={() => setPosPick(null)}
        />
      )}
    </div>
  );
}

function RosterTable({
  data,
  setRoster,
  onPickPos,
}: {
  data: ScorebookData;
  setRoster: (r: Player[]) => void;
  onPickPos: (id: string) => void;
}) {
  const R = data.roster;
  let order = 0;

  return (
    <>
      <div style={css('display:flex;justify-content:space-between;align-items:baseline')}>
        <SectionLabel>CHROMIES · ROSTER &amp; BATTING ORDER</SectionLabel>
        <span style={css("font:500 11px 'IBM Plex Mono',monospace;color:var(--muted3)")}>
          {R.filter((p) => p.bat).length} in lineup · {R.filter((p) => !p.bat).length} bench
        </span>
      </div>

      <div style={css('background:var(--card);border-radius:6px;overflow:hidden;overflow-x:auto')}>
        <div style={css(ROSTER_GRID + ';' + HEAD)}>
          <span>#</span>
          <span>NO</span>
          <span>NAME</span>
          <span>POS</span>
          <span>LINEUP</span>
          <span>ORDER</span>
          <span />
        </div>
        {R.map((p, i) => {
          const slot = p.bat ? String(++order) : '—';
          const fielding = p.pos !== 'EH' && p.pos !== 'UT';
          return (
            <div
              key={p.id}
              style={cssx(ROSTER_GRID + ';align-items:center;padding:8px 14px;border-top:1px solid var(--line)', {
                background: p.bat ? 'var(--card)' : 'var(--card2)',
              })}
            >
              <span style={css("font:600 13px 'IBM Plex Mono',monospace;color:var(--muted2)")}>{slot}</span>
              <input
                value={p.num}
                aria-label={`${p.name} jersey number`}
                onChange={(e) =>
                  setRoster(
                    R.map((x) =>
                      x.id === p.id ? { ...x, num: e.target.value.replace(/\D/g, '').slice(0, 2) } : x,
                    ),
                  )
                }
                style={css(
                  "min-height:40px;border:1px solid var(--line-strong);border-radius:4px;padding:0 8px;font:600 14px 'IBM Plex Mono',monospace;width:100%;box-sizing:border-box",
                )}
              />
              <input
                value={p.name}
                aria-label="Player name"
                onChange={(e) => setRoster(R.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
                style={css(
                  "min-height:40px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font:400 17px 'Permanent Marker',cursive;letter-spacing:.02em;width:100%;box-sizing:border-box",
                )}
              />
              <button
                type="button"
                onClick={() => onPickPos(p.id)}
                style={cssx(
                  "min-height:40px;border:1.5px solid var(--line-strong);border-radius:4px;padding:0 6px;font:700 13px 'IBM Plex Mono',monospace;width:100%",
                  {
                    background: fielding ? '#111' : 'var(--card)',
                    color: fielding ? '#FFC400' : 'var(--ink)',
                  },
                )}
              >
                {p.pos}
              </button>
              <button
                type="button"
                onClick={() => setRoster(R.map((x) => (x.id === p.id ? { ...x, bat: !x.bat } : x)))}
                style={cssx(
                  "min-height:40px;border:1.5px solid var(--line-strong);border-radius:4px;font:600 12px 'IBM Plex Sans',sans-serif",
                  { background: p.bat ? '#111' : 'var(--card)', color: p.bat ? '#fff' : 'var(--ink)' },
                )}
              >
                {p.bat ? 'Bats' : 'Bench'}
              </button>
              <span style={css('display:flex;gap:4px')}>
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => {
                    if (!i) return;
                    const r = [...R];
                    [r[i - 1], r[i]] = [r[i], r[i - 1]];
                    setRoster(r);
                  }}
                  style={css(NUDGE)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => {
                    if (i === R.length - 1) return;
                    const r = [...R];
                    [r[i + 1], r[i]] = [r[i], r[i + 1]];
                    setRoster(r);
                  }}
                  style={css(NUDGE)}
                >
                  ↓
                </button>
              </span>
              <button
                type="button"
                title="Remove"
                onClick={() => {
                  if (!confirm(`Remove ${p.name} from the roster? Past game logs keep their stats.`)) return;
                  setRoster(R.filter((x) => x.id !== p.id));
                }}
                style={css(
                  'width:40px;height:40px;border:0;border-radius:4px;background:transparent;color:var(--muted3);font-size:18px',
                )}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div style={css('display:flex;gap:8px;flex-wrap:wrap')}>
        <button
          type="button"
          onClick={() =>
            setRoster([...R, { id: 'p' + Date.now(), num: '', name: 'New player', pos: 'UT', bat: false }])
          }
          style={css(
            "min-height:44px;padding:0 16px;border:1.5px solid var(--line-strong);border-radius:4px;background:#111;color:#fff;font:600 13px 'IBM Plex Sans',sans-serif",
          )}
        >
          + Add player
        </button>
        <span style={css('font-size:12px;color:var(--muted);align-self:center')}>
          Order here is the batting order for new games. Changes to an in-progress game are made in Live →
          Manager.
        </span>
      </div>
    </>
  );
}

function BadGuys({
  data,
  save,
  setOpp,
}: {
  data: ScorebookData;
  save: (d: ScorebookData) => void;
  setOpp: (o: OppBatter[]) => void;
}) {
  const OL = data.oppLineup || [];
  const team = (data.oppTeam || '').trim();

  return (
    <>
      <div style={css('display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap')}>
        <SectionLabel>BAD GUYS · WHO ARE WE PLAYING?</SectionLabel>
        <span style={css("font:500 11px 'IBM Plex Mono',monospace;color:var(--muted3)")}>
          {OL.length} batters · name or number, either works
        </span>
      </div>

      <input
        value={data.oppTeam || ''}
        aria-label="Opponent team name"
        onChange={(e) => save({ ...data, oppTeam: e.target.value })}
        placeholder="Team name, e.g. Rockets"
        style={css(
          "min-height:52px;border:1.5px solid var(--line-strong);border-radius:6px;padding:0 16px;font:600 18px 'IBM Plex Sans',sans-serif;background:var(--card);width:100%;box-sizing:border-box",
        )}
      />

      {!team && (
        <div style={css('font-size:13px;color:var(--muted);line-height:1.5;text-wrap:pretty')}>
          Name the team first — then their lineup unlocks below. It carries into the next new game as the
          opponent.
        </div>
      )}

      {!!team && (
        <>
          <div style={css('background:var(--card);border-radius:6px;overflow:hidden;overflow-x:auto')}>
            <div style={css(OPP_GRID + ';' + HEAD)}>
              <span>#</span>
              <span>NO</span>
              <span>NAME</span>
              <span>ORDER</span>
              <span />
            </div>
            {!OL.length && (
              <div style={css('padding:14px;font-size:13px;color:var(--muted);line-height:1.5;text-wrap:pretty')}>
                No lineup for {data.oppTeam} yet. Add batters and the live screen steps through them in order
                instead of asking for a jersey number every trip. Leave it empty to keep the number pad.
              </div>
            )}
            {OL.map((o, i) => (
              <div
                key={i}
                style={css(OPP_GRID + ';align-items:center;padding:8px 14px;border-top:1px solid var(--line)')}
              >
                <span style={css("font:600 13px 'IBM Plex Mono',monospace;color:var(--muted2)")}>{i + 1}</span>
                <input
                  value={o.num}
                  aria-label={`Batter ${i + 1} number`}
                  placeholder="##"
                  onChange={(e) =>
                    setOpp(
                      OL.map((x, j) =>
                        j === i ? { ...x, num: e.target.value.replace(/\D/g, '').slice(0, 2) } : x,
                      ),
                    )
                  }
                  style={css(
                    "min-height:40px;border:1px solid var(--line-strong);border-radius:4px;padding:0 8px;font:600 14px 'IBM Plex Mono',monospace;width:100%;box-sizing:border-box;background:var(--card)",
                  )}
                />
                <input
                  value={o.name}
                  aria-label={`Batter ${i + 1} name`}
                  placeholder="Name (optional)"
                  onChange={(e) => setOpp(OL.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  style={css(
                    "min-height:40px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font:400 17px 'Permanent Marker',cursive;letter-spacing:.02em;width:100%;box-sizing:border-box;background:var(--card)",
                  )}
                />
                <span style={css('display:flex;gap:4px')}>
                  <button
                    type="button"
                    aria-label="Move up"
                    onClick={() => {
                      if (!i) return;
                      const l = [...OL];
                      [l[i - 1], l[i]] = [l[i], l[i - 1]];
                      setOpp(l);
                    }}
                    style={css(NUDGE)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    onClick={() => {
                      if (i === OL.length - 1) return;
                      const l = [...OL];
                      [l[i + 1], l[i]] = [l[i], l[i + 1]];
                      setOpp(l);
                    }}
                    style={css(NUDGE)}
                  >
                    ↓
                  </button>
                </span>
                <button
                  type="button"
                  title="Remove"
                  onClick={() => setOpp(OL.filter((_, j) => j !== i))}
                  style={css(
                    'width:40px;height:40px;border:0;border-radius:4px;background:transparent;color:var(--muted3);font-size:18px',
                  )}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div style={css('display:flex;gap:8px;flex-wrap:wrap;align-items:center')}>
            <button
              type="button"
              onClick={() => setOpp([...OL, { num: '', name: '' }])}
              style={css(
                "min-height:44px;padding:0 16px;border:1.5px solid var(--line-strong);border-radius:4px;background:#111;color:#fff;font:600 13px 'IBM Plex Sans',sans-serif",
              )}
            >
              + Add batter
            </button>
            <button
              type="button"
              onClick={() => {
                if ((OL.length || data.oppTeam) && !confirm('Clear the opposition team and lineup?')) return;
                save({ ...data, oppLineup: [], oppTeam: '' });
              }}
              style={css(
                "min-height:44px;padding:0 16px;border:1.5px solid var(--muted3);border-radius:4px;background:var(--card);font:600 13px 'IBM Plex Sans',sans-serif",
              )}
            >
              Clear for next opponent
            </button>
            <span style={css('font-size:12px;color:var(--muted)')}>
              Applies to the next new game. Reset it each week.
            </span>
          </div>
        </>
      )}
    </>
  );
}

function Defaults({ data, save }: { data: ScorebookData; save: (d: ScorebookData) => void }) {
  const theme: Theme = data.settings.theme ?? 'light';
  const setTheme = (t: Theme) => save({ ...data, settings: { ...data.settings, theme: t } });
  const row =
    'background:var(--card);border-radius:6px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap';

  return (
    <div style={css('display:flex;flex-direction:column;gap:8px')}>
      <SectionLabel>DEFAULTS</SectionLabel>
      <div style={css(row)}>
        <span style={css('font-size:14px;font-weight:500')}>Appearance</span>
        <div style={css('display:grid;grid-template-columns:repeat(2,96px);gap:4px')}>
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              aria-pressed={theme === t}
              style={cssx(
                "min-height:40px;border:1.5px solid var(--line-strong);border-radius:4px;font:600 13px 'IBM Plex Sans',sans-serif",
                { background: theme === t ? '#111' : 'var(--card)', color: theme === t ? '#fff' : 'var(--ink)' },
              )}
            >
              {t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </div>
      <div style={css(row)}>
        <span style={css('font-size:14px;font-weight:500')}>Default time limit</span>
        <div style={css('display:grid;grid-template-columns:repeat(4,64px);gap:4px')}>
          {LIMITS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => save({ ...data, settings: { ...data.settings, timeLimit: m } })}
              style={cssx(
                "min-height:40px;border:1.5px solid var(--line-strong);border-radius:4px;font:600 13px 'IBM Plex Mono',monospace",
                {
                  background: data.settings.timeLimit === m ? '#111' : 'var(--card)',
                  color: data.settings.timeLimit === m ? '#fff' : 'var(--ink)',
                },
              )}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DataPanel({
  data,
  save,
  msg,
  setMsg,
}: {
  data: ScorebookData;
  save: (d: ScorebookData) => void;
  msg: string;
  setMsg: (m: string) => void;
}) {
  const nav = useNav();
  const btn =
    "min-height:44px;padding:0 16px;border:1.5px solid var(--line-strong);border-radius:4px;background:var(--card);font:600 13px 'IBM Plex Sans',sans-serif";
  const btnQuiet =
    "min-height:44px;padding:0 16px;border:1.5px solid var(--muted3);border-radius:4px;background:var(--card);color:var(--ink);font:600 13px 'IBM Plex Sans',sans-serif";

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chromies-scorebook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Exported.');
  };

  const importJson = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    void f.text().then((text) => {
      try {
        const d = JSON.parse(text) as Partial<ScorebookData>;
        const ids = new Set(data.games.map((g) => g.id));
        const added = (d.games ?? []).filter((g) => !ids.has(g.id));
        save({
          ...data,
          roster: d.roster ?? data.roster,
          games: [...data.games, ...added],
          settings: d.settings ?? data.settings,
        });
        setMsg(`Imported ${added.length} new games.`);
      } catch {
        setMsg('Import failed: not a valid scorebook file.');
      }
    });
  };

  return (
    <div style={css('display:flex;flex-direction:column;gap:8px')}>
      <SectionLabel>DATA</SectionLabel>
      <div
        style={css(
          'background:var(--card);border-radius:6px;padding:14px 16px;display:flex;flex-direction:column;gap:10px',
        )}
      >
        <div style={css('font-size:13px;color:var(--muted);line-height:1.5;text-wrap:pretty')}>
          Everything is stored on this device. Export a JSON backup any time; import merges games by id.
          Sample games are marked and can be removed without touching your own.
        </div>
        <div style={css('display:flex;gap:8px;flex-wrap:wrap')}>
          <button type="button" onClick={exportJson} style={css(btn)}>
            Export JSON
          </button>
          <label
            style={css(
              btn + ';display:inline-flex;align-items:center;cursor:pointer',
            )}
          >
            Import JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={importJson}
              style={css('display:none')}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const ids = new Set(data.games.map((g) => g.id));
              const sample = S.sampleSeason(data.roster, {
                games: 30,
                seasons: 2,
                year: new Date().getFullYear(),
              }).filter((g) => !ids.has(g.id));
              save({ ...data, games: [...data.games, ...sample] });
              setMsg(`Added ${sample.length} sample games.`);
            }}
            style={css(btnQuiet)}
          >
            Load sample season
          </button>
          <button
            type="button"
            onClick={() => {
              const games = data.games.filter((g) => !g.sample);
              save({
                ...data,
                games,
                activeId: games.some((g) => g.id === data.activeId) ? data.activeId : null,
              });
              setMsg('Sample games removed.');
              nav.openGame(null);
            }}
            style={css(btnQuiet)}
          >
            Remove sample games
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                !confirm('Reset roster, games and settings to the starting sample? Export first if you want a backup.')
              )
                return;
              save(freshData());
              setMsg('Reset.');
              nav.openGame(null);
              nav.openPlayer(null);
            }}
            style={css(btnQuiet.replace('color:var(--ink)', 'color:#8A1C1C'))}
          >
            Reset everything
          </button>
        </div>
        <span style={css("font:500 12px 'IBM Plex Mono',monospace;color:var(--muted)")}>{msg}</span>
      </div>
    </div>
  );
}

function PositionPicker({
  player,
  roster,
  onAssign,
  onClose,
}: {
  player: Player;
  roster: Player[];
  onAssign: (pos: Position) => void;
  onClose: () => void;
}) {
  const spots = E.FIELDERS.map((f) => {
    const holder = roster.find((x) => x.pos === f.pos);
    const mine = holder?.id === player.id;
    const taken = !!holder && !mine;
    const surname = holder ? holder.name.trim().split(/\s+/).pop() || holder.name.trim() : '';
    return {
      pos: f.pos,
      x: f.x,
      y: f.y,
      pctX: f.x + '%',
      pctY: Math.min(93, f.y + 5.5) + '%',
      fill: mine ? '#FFC400' : taken ? '#BDBDBD' : '#fff',
      stroke: mine ? '#111' : taken ? '#555' : '#111',
      who: holder ? (holder.num ? '#' + holder.num + ' ' : '') + surname : 'open',
      whoFg: mine ? '#FFC400' : holder ? '#fff' : '#CCC',
    };
  });

  const LABEL =
    "font:700 3.6px 'IBM Plex Mono',monospace;fill:#111;pointer-events:none;paint-order:stroke;stroke:#fff;stroke-width:.4px";

  return (
    <Modal width="min(560px,100%)" onClose={onClose}>
      <div
        style={css(
          'padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #333',
        )}
      >
        <div style={css('display:flex;flex-direction:column;gap:2px')}>
          <span style={css("font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.1em;color:#FFC400")}>
            POSITION
          </span>
          <span style={css("font:600 18px 'IBM Plex Sans',sans-serif")}>
            {player.name} <span style={css('color:#AAA;font-weight:500')}>· tap a spot on the field</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={css(
            'min-width:44px;min-height:40px;border:1.5px solid #444;border-radius:4px;background:transparent;color:#fff;font-size:18px',
          )}
        >
          ×
        </button>
      </div>

      <div style={css('position:relative')}>
        <svg viewBox="0 0 100 100" style={css('width:100%;display:block')}>
          <FieldBackdrop extent={100} plate />
          {spots.map((s) => (
            <g key={s.pos} onClick={() => onAssign(s.pos)} style={css('cursor:pointer')}>
              <circle cx={s.x} cy={s.y} r="7" fill="transparent" />
              <circle cx={s.x} cy={s.y} r="5" fill={s.fill} stroke={s.stroke} strokeWidth=".9" />
            </g>
          ))}
          {spots.map((s) => (
            <text
              key={s.pos}
              x={s.x}
              y={s.y}
              textAnchor="middle"
              dominantBaseline="central"
              style={css(LABEL)}
            >
              {s.pos}
            </text>
          ))}
        </svg>
        {spots.map((s) => (
          <div
            key={s.pos}
            style={cssx(
              "position:absolute;transform:translate(-50%,0);pointer-events:none;font:600 11px 'IBM Plex Sans',sans-serif;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap",
              { left: s.pctX, top: s.pctY, color: s.whoFg },
            )}
          >
            {s.who}
          </div>
        ))}
      </div>

      <div style={css('padding:12px 20px 18px;display:flex;flex-direction:column;gap:10px')}>
        <div style={css('display:flex;gap:6px;flex-wrap:wrap')}>
          {([
            ['EH', 'Extra hitter (EH)'],
            ['UT', 'Utility / no position'],
          ] as const).map(([pos, label]) => {
            const on = player.pos === pos;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => onAssign(pos)}
                style={cssx("min-height:44px;padding:0 14px;border-radius:4px;font:600 13px 'IBM Plex Sans',sans-serif", {
                  border: `1.5px solid ${on ? '#FFC400' : '#444'}`,
                  background: on ? '#FFC400' : 'transparent',
                  color: on ? '#111' : '#fff',
                })}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div style={css('font-size:12px;color:#AAA;line-height:1.5;text-wrap:pretty')}>
          Slowpitch: ten fielders with four outfielders (LF, LC, RC, RF). Amber = this player, grey = taken,
          white = open. tapping it reassigns the spot to {player.name} and moves the other player to EH.
        </div>
      </div>
    </Modal>
  );
}
