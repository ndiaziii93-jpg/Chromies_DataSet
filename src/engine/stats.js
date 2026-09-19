// Derived stats over engine game logs. Nothing here is stored; everything is computed from logs.
import * as E from './scoring.js';

export const HITS = new Set(E.OUTCOMES.hits);
export const usLog = (g, l) => !l.scoreOnly && !l.manager && ((l.half === 'top') === g.weBatFirst);
export const themLog = (g, l) => !l.scoreOnly && !l.manager && ((l.half === 'top') !== g.weBatFirst);

export function batting(games, name) {
  const s = { pa: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, k: 0, rbi: 0, sf: 0, tb: 0, r: 0, spray: [], contact: { GB: 0, FB: 0, LD: 0, PU: 0 }, games: 0 };
  for (const g of games) {
    let played = false;
    for (const l of g.log) {
      if (!usLog(g, l)) { if (!l.scoreOnly && !l.manager && l.runs && l.runs.includes && l.runs.includes(name) && ((l.half === 'top') === g.weBatFirst)) s.r++; continue; }
      if (l.runs && l.runs.includes(name)) s.r++;
      if (l.batter !== name) continue;
      played = true;
      const o = l.outcome;
      // A tally is not a trip to the plate — the at-bat is still going, and its real
      // outcome arrives as its own log line. Count it, then get out of the way.
      if (E.TALLY_ONLY.has(o)) { if (o === 'HBP') s.hbp++; continue; }
      s.pa++;
      if (!['BB', 'SF'].includes(o)) s.ab++;
      if (HITS.has(o)) { s.h++; s.tb += { '1B': 1, '2B': 2, '3B': 3, HR: 4 }[o]; if (o === '2B') s.b2++; if (o === '3B') s.b3++; if (o === 'HR') s.hr++; }
      if (o === 'BB') s.bb++; if (o === 'K') s.k++; if (o === 'SF') s.sf++;
      s.rbi += l.rbi || 0;
      if (l.fieldX != null) { s.spray.push({ x: l.fieldX, y: l.fieldY, hit: HITS.has(o), outcome: o }); if (s.contact[l.contact] != null) s.contact[l.contact]++; }
    }
    if (played) s.games++;
  }
  s.avg = s.ab ? s.h / s.ab : 0;
  s.obp = s.pa ? (s.h + s.bb) / (s.ab + s.bb + s.sf || 1) : 0;
  s.slg = s.ab ? s.tb / s.ab : 0;
  s.bip = s.spray.length;
  s.pull = s.bip ? s.spray.filter(p => p.x < 44).length / s.bip : 0; // right-handed pull side = left field
  s.center = s.bip ? s.spray.filter(p => p.x >= 44 && p.x <= 56).length / s.bip : 0;
  s.oppo = s.bip ? 1 - s.pull - s.center : 0;
  return s;
}
export function fielding(games, pos) {
  const f = { PO: 0, A: 0, E: 0 };
  for (const g of games) for (const l of g.log) if (themLog(g, l) && l.attr) for (const k of Object.keys(l.attr)) if (l.attr[k] === pos && f[k] != null) f[k]++;
  return f;
}
export function teamBatting(games) {
  const all = { ab: 0, h: 0, bb: 0, hbp: 0, sf: 0, k: 0 };
  for (const g of games) for (const l of g.log) if (usLog(g, l)) {
    const o = l.outcome;
    if (o === 'HBP') { all.hbp++; continue; }
    if (!['BB', 'SF'].includes(o)) all.ab++;
    if (HITS.has(o)) all.h++; if (o === 'BB') all.bb++; if (o === 'SF') all.sf++; if (o === 'K') all.k++;
  }
  all.avg = all.ab ? all.h / all.ab : 0; all.obp = (all.ab + all.bb + all.sf) ? (all.h + all.bb) / (all.ab + all.bb + all.sf) : 0;
  return all;
}
export function lineScore(g, n = 7) {
  const played = g.log.reduce((a, l) => Math.max(a, l.inning || 0), 1);
  const lastInn = g.status === 'final' ? played : g.inning;
  const inn = Array.from({ length: Math.max(n, lastInn) }, (_, i) => i + 1);
  const runs = (side, k) => g.log.filter(l => l.inning === k && !l.manager && (side === 'us' ? ((l.half === 'top') === g.weBatFirst) : ((l.half === 'top') !== g.weBatFirst))).reduce((a, l) => a + (l.scoreOnly ? l.runs : l.runs.length), 0);
  const usBatting = E.weAreBatting(g);
  const started = (side, k) => {
    if (g.status === 'final') return k <= lastInn;
    if (k < g.inning) return true; if (k > g.inning) return false;
    const usTop = g.weBatFirst; const topDone = g.half === 'bottom';
    return side === 'us' ? (usTop || topDone || usBatting) : (!usTop || topDone || !usBatting);
  };
  const cells = side => inn.map(k => ({ v: started(side, k) ? String(runs(side, k)) : '', cur: k === g.inning && g.status !== 'final' }));
  return { innings: inn, us: cells('us'), them: cells('them'),
    hitsUs: g.log.filter(l => usLog(g, l) && HITS.has(l.outcome)).length, hitsThem: g.log.filter(l => themLog(g, l) && HITS.has(l.outcome)).length,
    errUs: g.log.filter(l => themLog(g, l) && l.outcome === 'E').length, errThem: g.log.filter(l => usLog(g, l) && l.outcome === 'E').length };
}
export function fmt3(v) { return (v || 0).toFixed(3).replace(/^0/, ''); }
export function record(games) {
  const f = games.filter(g => g.status === 'final');
  const w = f.filter(g => g.score.us > g.score.them).length, l = f.filter(g => g.score.us < g.score.them).length;
  return { w, l, t: f.length - w - l, rf: f.reduce((a, g) => a + g.score.us, 0), ra: f.reduce((a, g) => a + g.score.them, 0) };
}
export function topPerformers(g, roster) {
  return g.lineup.map(name => ({ name, ...batting([g], name) })).filter(p => p.pa).sort((a, b) => (b.h * 2 + b.rbi + b.bb) - (a.h * 2 + a.rbi + a.bb)).slice(0, 3);
}

// Deterministic sample season so the app has something to show. Every number in the app is derived from these logs.
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const W = [['1B', 20], ['2B', 6], ['3B', 1], ['HR', 2], ['BB', 9], ['HBP', 1], ['E', 3], ['FC', 2], ['K', 17], ['GO', 18], ['FO', 14], ['LO', 3], ['PO', 3], ['SF', 1], ['DP', 1]];
function pick(r, weights) { const tot = weights.reduce((a, w) => a + w[1], 0); let x = r() * tot; for (const [o, w] of weights) { if ((x -= w) < 0) return o; } return 'GO'; }
function spot(r, o, pullBias) {
  const side = () => { const p = r(); return pullBias ? (p < .55 ? -1 : p < .8 ? 0 : 1) : (p < .35 ? -1 : p < .7 ? 0 : 1); };
  const sx = side(), j = r() * 12 - 6;
  const bands = { GO: [58, 84], FC: [60, 82], DP: [60, 80], E: [55, 80], PO: [52, 78], LO: [42, 64], '1B': [40, 66], FO: [26, 48], SF: [26, 40], '2B': [26, 42], '3B': [24, 34], HR: [20, 28] };
  const [a, b] = bands[o] || [40, 70]; const y = a + r() * (b - a);
  const spread = (92 - y) * 0.85; let x = 50 + sx * spread * (0.45 + r() * 0.45) + j;
  x = Math.max(50 - (92 - y) * 0.98, Math.min(50 + (92 - y) * 0.98, x));
  return { x: Math.round(x), y: Math.round(y) };
}
export function sampleSeason(roster, opts = {}) {
  const r = rng(opts.seed || 7);
  const opps = ['Rockets', 'Otters', 'Hawks', 'Millers', 'Comets', 'Pines', 'Foxes', 'Anchors', 'Bandits', 'Vipers', 'Knights', 'Sluggers', 'Mudcats', 'Rebels', 'Storm'];
  const gamesPer = opts.games || 10; const seasons = opts.seasons || 1; const year = opts.year || 2026;
  const starters = roster.filter(p => p.bat).length >= 8 ? roster.filter(p => p.bat) : roster.slice(0, 10);
  const bench = roster.filter(p => !starters.includes(p));
  const games = [];
  for (let gi = 0; gi < gamesPer * seasons; gi++) {
    const season = Math.floor(gi / gamesPer), wk = gi % gamesPer;
    // two games most weekends: Sat 17:00 and Sun 15:00, season runs late April through October
    const start = Date.UTC(year - (seasons - 1 - season), 3, 25 + Math.floor(wk / 2) * 7 + (wk % 2 ? 1 : 0), wk % 2 ? 15 : 17);
    // rotate: each game, up to two bench players take a lineup spot so everyone accumulates stats
    let lineup = starters.map(p => p.id);
    if (bench.length) { const swaps = Math.min(2, bench.length); for (let k = 0; k < swaps; k++) { const b = bench[(gi * swaps + k) % bench.length]; const slot = (gi * 3 + k * 4) % lineup.length; lineup[slot] = b.id; } }
    let g = E.newGame(lineup, { weBatFirst: gi % 2 === 0, startedAt: start, timeLimitMins: 60 });
    g.id = 'g' + (gi + 1); g.opp = opps[(gi * 7 + season * 3) % opps.length]; g.date = start; g.sample = true;
    const oppStrength = 0.6 + r() * 0.8;
    let guard = 0;
    // 7-inning slowpitch game: top of order gets 4 trips, bottom 3
    while (g.inning <= 7 && g.status === 'in_progress' && guard++ < 600) {
      const us = E.weAreBatting(g);
      if (!us) g = E.setOppBatter(g, String(1 + Math.floor(r() * 30)));
      let weights = W;
      if (!us) weights = W.map(([o, w]) => [o, HITS.has(o) || o === 'BB' ? w * oppStrength : w]);
      if (us) { const bId = g.lineup[g.batterIdx % g.lineup.length]; let hsh = 0; for (const ch of String(bId)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; const talent = 0.75 + ((hsh % 100) / 100) * 0.6 + (season ? (((hsh >> 4) % 7) - 3) * 0.04 : 0); weights = W.map(([o, w]) => [o, HITS.has(o) ? w * talent : o === 'K' ? w * 0.8 / talent : w]); }
      const o = pick(r, weights);
      g = E.recordOutcome(g, o);
      if (g.pending) { const bIdx = g.batterIdx % lineup.length; const s = spot(r, o, us && bIdx % 3 !== 1); g = E.recordField(g, s.x, s.y); }
    }
    if (gi % 4 === 1 && bench.length) { const b = bench[(gi + 2) % bench.length]; const outId = lineup[8 % lineup.length]; const outP = roster.find(p => p.id === outId); if (b && outP && b.id !== outId) { g.log = [...g.log, { inning: 4, half: 'top', manager: true, note: `${b.name.trim()} pinch hits for ${outP.name.trim()} (9)` }]; } }
    g = E.endGame(g); g.history = [];
    games.push(g);
  }
  return games;
}
