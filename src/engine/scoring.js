// Chromies scoring engine — pure functions over a game state. No derived stats stored.
export const OUTCOMES = {
  hits: ['1B','2B','3B','HR'],
  onBase: ['BB','HBP','E','FC'],
  outs: ['K','GO','FO','LO','PO','SF','DP'],
};
export const NO_FIELD = new Set(['K','BB','HBP']);
export const LABEL = {'1B':'Single','2B':'Double','3B':'Triple',HR:'Home run',BB:'Walk',HBP:'Hit by pitch',E:'Error',FC:"Fielder's choice",K:'Strikeout',GO:'Groundout',FO:'Flyout',LO:'Lineout',PO:'Pop out',SF:'Sac fly',DP:'Double play'};
// Slowpitch: 10 fielders (four outfielders). Field coordinates in a 0–100 square, home plate at (50,92).
export const FIELDERS = [
  {pos:'P',x:50,y:63},{pos:'C',x:50,y:95},{pos:'1B',x:70,y:62},{pos:'2B',x:60,y:50},
  {pos:'3B',x:30,y:62},{pos:'SS',x:40,y:50},{pos:'LF',x:20,y:36},{pos:'LC',x:38,y:24},{pos:'RC',x:62,y:24},{pos:'RF',x:80,y:36},
];
export const BASE_XY = [{x:50,y:92},{x:74,y:68},{x:50,y:44},{x:26,y:68}]; // home,1st,2nd,3rd

export function newGame(lineup, opts = {}) {
  return {
    inning: 1, half: 'top', outs: 0, bases: [null, null, null],
    score: { us: 0, them: 0 }, log: [], history: [], pending: null,
    batterIdx: 0, oppBatter: null, lineup, mode: 'full',
    weBatFirst: opts.weBatFirst ?? false, startedAt: opts.startedAt ?? Date.now(),
    timeLimitMins: opts.timeLimitMins ?? 60, status: 'in_progress',
  };
}
export const weAreBatting = g => (g.half === 'top') === g.weBatFirst;
const snap = g => ({ ...g, bases: [...g.bases], score: { ...g.score }, log: [...g.log], history: g.history });
const push = g => { const s = snap(g); s.history = [...g.history, snap({ ...g, history: [] })]; return s; };

export function undo(g) {
  if (!g.history.length) return g;
  const prev = g.history[g.history.length - 1];
  return { ...prev, history: g.history.slice(0, -1) };
}

export function inferFielder(x, y) {
  let best = null, d = Infinity;
  for (const f of FIELDERS) { const dd = (f.x - x) ** 2 + (f.y - y) ** 2; if (dd < d) { d = dd; best = f; } }
  return best.pos;
}
export function inferContact(outcome, y) {
  if (['GO','FC','DP','E'].includes(outcome)) return 'GB';
  if (['FO','SF','HR'].includes(outcome)) return 'FB';
  if (outcome === 'LO') return 'LD';
  if (outcome === 'PO') return 'PU';
  return y < 40 ? 'FB' : 'LD';
}
export function attribution(outcome, contact, fielder) {
  if (outcome === 'K') return { PO: 'C' };
  if (outcome === 'E') return { E: fielder };
  if (!OUTCOMES.outs.includes(outcome) && outcome !== 'FC') return {};
  if (contact === 'GB') return { A: fielder, PO: fielder === '1B' ? 'P' : '1B' };
  return { PO: fielder };
}

function advance(outcome, bases, batter) {
  const [b1, b2, b3] = bases; let runs = []; let out = 0; let nb = [null, null, null];
  const score = r => { if (r) runs.push(r); };
  switch (outcome) {
    case '1B': score(b3); nb = [batter, b1, b2]; break;
    case '2B': score(b3); score(b2); nb = [null, batter, b1]; break;
    case '3B': score(b3); score(b2); score(b1); nb = [null, null, batter]; break;
    case 'HR': score(b3); score(b2); score(b1); score(batter); break;
    case 'BB': case 'HBP': case 'E':
      if (b1 && b2 && b3) score(b3);
      nb = b1 ? (b2 ? [batter, b1, b2] : [batter, b1, b3]) : [batter, b2, b3];
      break;
    case 'FC': out = 1; // lead forced runner out, batter safe at 1st
      nb = !b1 ? [batter, b2, b3] : !b2 ? [batter, null, b3] : !b3 ? [batter, b1, null] : [batter, b1, b2];
      break;
    case 'SF': out = 1; score(b3); nb = [b1, b2, null]; break;
    case 'DP': out = 2; nb = b1 ? [null, b2, b3] : [b1, b2, b3]; if (!b1) out = 1; break;
    default: out = 1; nb = [b1, b2, b3];
  }
  return { bases: nb, runs, out };
}

export function recordOutcome(g, outcome) {
  if (g.status !== 'in_progress') return g;
  if (!NO_FIELD.has(outcome) && g.mode === 'full') { return { ...g, pending: { outcome } }; }
  return commit(g, outcome, null);
}
export function recordField(g, x, y) {
  if (!g.pending) return g;
  const fielder = inferFielder(x, y);
  return commit(g, g.pending.outcome, { x, y, fielder, contact: inferContact(g.pending.outcome, y) });
}
export function cancelPending(g) { return { ...g, pending: null }; }

function batterName(g) {
  return weAreBatting(g) ? g.lineup[g.batterIdx % g.lineup.length] : (g.oppBatter ? '#' + g.oppBatter : 'Opp');
}
function commit(g0, outcome, field) {
  let g = push(g0); g.pending = null;
  const batter = batterName(g);
  const { bases, runs, out } = advance(outcome, g.bases, batter);
  const attr = attribution(outcome, field?.contact ?? (outcome === 'K' ? null : 'GB'), field?.fielder);
  const rbi = ['E', 'DP'].includes(outcome) ? 0 : runs.length;
  g.log = [...g.log, { inning: g.inning, half: g.half, batter, outcome, contact: field?.contact ?? 'none', fieldX: field?.x, fieldY: field?.y, fielder: field?.fielder, attr, runs, rbi, outsBefore: g.outs, basesBefore: g0.bases, basesAfter: bases }];
  if (weAreBatting(g)) g.score.us += runs.length; else g.score.them += runs.length;
  g.bases = bases; g.outs += out;
  if (weAreBatting(g)) g.batterIdx += 1; else g.oppBatter = null;
  if (g.outs >= 3) g = endHalf(g);
  return g;
}
export function endHalf(g) {
  const lob = g.bases.filter(Boolean).length;
  const n = { ...g, outs: 0, bases: [null, null, null], pending: null, lob: (g.lob || 0) + lob };
  if (g.half === 'top') n.half = 'bottom'; else { n.half = 'top'; n.inning += 1; }
  return n;
}
export function scoreOnlyRun(g, delta) {
  let n = push(g); if (weAreBatting(n)) n.score.us = Math.max(0, n.score.us + delta); else n.score.them = Math.max(0, n.score.them + delta);
  n.log = [...n.log, { inning: n.inning, half: n.half, scoreOnly: true, runs: delta }]; return n;
}
export function scoreOnlyOut(g) { let n = push(g); n.outs += 1; if (n.outs >= 3) n = endHalf(n); return n; }
// Tap a runner: move them one base forward (scores from 3rd). The exception correction.
export function moveRunner(g, baseIdx) {
  if (!g.bases[baseIdx]) return g;
  let n = push(g); const r = n.bases[baseIdx]; n.bases[baseIdx] = null;
  if (baseIdx === 2) { if (weAreBatting(n)) n.score.us += 1; else n.score.them += 1; }
  else if (!n.bases[baseIdx + 1]) n.bases[baseIdx + 1] = r; else return g;
  return n;
}
export function setOppBatter(g, num) { return { ...g, oppBatter: num }; }
export function managerMove(g, note, lineup) { let n = push(g); n.log = [...n.log, { inning: n.inning, half: n.half, manager: true, note }]; if (lineup) n.lineup = lineup; return n; }
export function setMode(g, mode) { return { ...g, mode, pending: null }; }
export function endGame(g) { return { ...g, status: 'final', pending: null }; }
export function elapsed(g, now = Date.now()) { const s = Math.max(0, Math.floor((now - g.startedAt) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
export function timeLeft(g, now = Date.now()) {
  const s = Math.max(0, g.timeLimitMins * 60 - Math.floor((now - g.startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const ordinal = n => n + (['th','st','nd','rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
