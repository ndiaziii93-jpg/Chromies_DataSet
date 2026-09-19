import type { Game, Player, Position, ScorebookData } from '../lib/types';

export const STORAGE_KEY = 'chromies-scorebook-v5';
const LEGACY_KEYS = ['chromies-scorebook-v4', 'chromies-scorebook-v3', 'chromies-scorebook-v2'];

/**
 * The Chromies. Order is the batting order; the first ten bat and hold the ten
 * slowpitch fielding spots, the rest are bench (UT) until a manager moves them in.
 * Edit this in the app under Manage → Chromies, not here — this is only the
 * starting point for a device that has never been used.
 *
 * Numbers are transcribed from the 2026 paper scorebooks, which are the source
 * of truth for jerseys. Some people appear under more than one label in the
 * books; they are one person each here:
 *   Emeron  — also written "Emo"
 *   Doc     — also written "Eric"
 *   Berto   — also written "Berto Jr." / "Berto Sr."
 *   Brian   — spelled Brian, not Bryan
 * Manuel (#33, sometimes "M. Pinto") and Manny (#87) are two different people.
 * Blank numbers are people the books never wrote a jersey for.
 */
const ROSTER: Omit<Player, 'id'>[] = [
  { num: '33', name: 'Manuel',   pos: 'SS', bat: true },
  { num: '26', name: 'Machteld', pos: 'LC', bat: true },
  { num: '19', name: 'Berto',    pos: 'RC', bat: true },
  { num: '18', name: 'Chiya',    pos: '3B', bat: true },
  { num: '40', name: 'Emeron',   pos: '2B', bat: true },
  { num: '75', name: 'Nanako',   pos: 'RF', bat: true },
  { num: '8',  name: 'George',   pos: 'P',  bat: true },
  { num: '55', name: 'Amie',     pos: '1B', bat: true },
  { num: '77', name: 'Doc',      pos: 'LF', bat: true },
  { num: '99', name: 'Taci',     pos: 'C',  bat: true },
  { num: '15', name: 'Ysa',      pos: 'UT', bat: false },
  { num: '39', name: 'Amit',     pos: 'UT', bat: false },
  { num: '16', name: 'Brian',    pos: 'UT', bat: false },
  { num: '87', name: 'Manny',    pos: 'UT', bat: false },
  { num: '27', name: 'Kenzie',   pos: 'UT', bat: false },
  { num: '31', name: 'Jana',     pos: 'UT', bat: false },
  { num: '4',  name: 'Bekah',    pos: 'UT', bat: false },
  { num: '',   name: 'Pim',      pos: 'UT', bat: false },
  { num: '',   name: 'Erica',    pos: 'UT', bat: false },
  { num: '',   name: 'Courtney', pos: 'UT', bat: false },
  { num: '',   name: 'Alexa',    pos: 'UT', bat: false },
  { num: '',   name: 'Rachel',   pos: 'UT', bat: false },
  { num: '',   name: 'Emma',     pos: 'UT', bat: false },
  { num: '',   name: 'Spencer',  pos: 'UT', bat: false },
];

export function freshRoster(): Player[] {
  return ROSTER.map((p, i) => ({ id: 'p' + (i + 1), ...p }));
}

export function freshData(): ScorebookData {
  return {
    roster: freshRoster(),
    oppLineup: [],
    // No games. These are real people, and a generated season would hang
    // invented batting averages on their names. Manage → Data → Load sample
    // season fills the app with demo games whenever you want to see it populated.
    games: [],
    activeId: null,
    settings: { timeLimit: 60 },
  };
}

/** An early build called the fourth outfielder CF and the extra hitter DH. */
function renameLegacyPositions(data: ScorebookData): ScorebookData {
  const fixLog = (g: Game): Game => ({
    ...g,
    log: g.log.map((l) =>
      'fielder' in l && l.fielder === 'CF'
        ? {
            ...l,
            fielder: 'LC',
            attr: Object.fromEntries(
              Object.entries(l.attr ?? {}).map(([k, v]) => [k, v === 'CF' ? 'LC' : v]),
            ),
          }
        : l,
    ),
  });
  return {
    ...data,
    roster: data.roster.map((p) =>
      p.pos === ('CF' as Position) ? { ...p, pos: 'LC' as Position }
      : p.pos === ('DH' as Position) ? { ...p, pos: 'EH' as Position }
      : p,
    ),
    games: data.games.map(fixLog),
  };
}

/**
 * One-time roster repair for a device that already has a book saved.
 *
 * The first build shipped placeholder jersey numbers. The paper scorebooks are
 * the real ones, so this rewrites the number on every player the books name,
 * fixes the Bryan/Brian spelling, and adds the people who turn up in the books
 * but were missing from the app. It runs only when a document is read from an
 * older storage key, so a manager who edits a number afterwards keeps their edit.
 */
function applyScorebookRoster(data: ScorebookData): ScorebookData {
  if (!data.roster?.length) return data;

  const byName = new Map(ROSTER.map((p) => [p.name.toLowerCase(), p]));
  const rename: Record<string, string> = { bryan: 'Brian', emo: 'Emeron', eric: 'Doc' };

  const roster = data.roster.map((p) => {
    const name = rename[p.name.trim().toLowerCase()] ?? p.name.trim();
    const known = byName.get(name.toLowerCase());
    return known ? { ...p, name, num: known.num } : { ...p, name };
  });

  // Anyone in the books who never made it into the saved roster joins the bench.
  const have = new Set(roster.map((p) => p.name.toLowerCase()));
  let n = roster.length;
  const taken = new Set(roster.map((p) => p.id));
  const nextId = () => {
    let id: string;
    do { id = 'p' + ++n; } while (taken.has(id));
    taken.add(id);
    return id;
  };
  for (const p of ROSTER) {
    if (!have.has(p.name.toLowerCase())) roster.push({ id: nextId(), ...p });
  }

  return { ...data, roster };
}

/**
 * Fills in fields added after a document was first written.
 *
 * `history` matters here: the undo stack is never persisted or synced, so a game
 * read back from localStorage or pulled from the server arrives without one, and
 * the engine's snapshot helper spreads it on the next play. Restoring it to an
 * empty array is what keeps the first tap after a reload from throwing.
 */
export function normalize(data: ScorebookData): ScorebookData {
  const d = renameLegacyPositions(data);
  const games = (d.games ?? []).map((g) => (g.history ? g : { ...g, history: [] }));
  return {
    ...d,
    oppLineup: d.oppLineup ?? [],
    settings: { ...d.settings, timeLimit: d.settings?.timeLimit ?? 60 },
    games,
    // Only an in-progress game is the active one; a document written before that
    // was enforced can still point at a final game.
    activeId: games.some((g) => g.id === d.activeId && g.status === 'in_progress')
      ? d.activeId
      : null,
  };
}

function readKey(key: string): ScorebookData | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ScorebookData) : null;
  } catch {
    return null;
  }
}

/** Reads the local document, migrating an older prototype one if that's all there is. */
export function loadLocal(): ScorebookData | null {
  const current = readKey(STORAGE_KEY);
  if (current) return normalize(current);

  for (const key of LEGACY_KEYS) {
    const old = readKey(key);
    if (!old?.roster) continue;
    // A roster that was never edited is the untouched demo — start clean instead.
    if (old.roster.every((p) => /^Player \d+$/.test(p.name.trim()))) return null;
    // Keep whatever games they had; don't invent a season for a real roster.
    return normalize(applyScorebookRoster(old));
  }
  return null;
}

export function saveLocal(data: ScorebookData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripHistory(data)));
  } catch {
    // Private mode or a full quota. The in-memory document is still correct and
    // the next save retries; where a project is configured, the server copy is
    // the durable one.
  }
}

/**
 * Drops the undo stack. It is per-session scratch: it never goes to the server,
 * and it is left out of the local cache too, because each snapshot carries a full
 * copy of the game and a long game's stack would crowd out the scorebook itself
 * in a 5 MB localStorage budget. Undo works for the whole game; a reload clears it.
 */
export function stripHistory(data: ScorebookData): ScorebookData {
  return { ...data, games: data.games.map(({ history: _history, ...g }) => g as Game) };
}
