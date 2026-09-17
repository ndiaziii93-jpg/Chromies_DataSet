import * as S from '../engine/stats.js';
import type { Game, Player, Position, ScorebookData } from '../lib/types';

export const STORAGE_KEY = 'chromies-scorebook-v4';
const LEGACY_KEYS = ['chromies-scorebook-v3', 'chromies-scorebook-v2'];

const POS: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'LC', 'RC', 'RF', 'EH', 'UT'];
const NAMES = [
  'Marcus Reyes', 'Tyler Boone', 'Andre Whitfield', 'Kevin Okafor',
  'Danny Russo', 'Jamal Carter', 'Luis Herrera', 'Brett Sandoval',
  'Chris Nakamura', 'Derek Flores', 'Tony Mendes', 'Sam Kowalski',
];
const NUMS = ['7', '12', '3', '21', '9', '15', '4', '28', '11', '33', '18', '2'];

export function freshRoster(): Player[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: 'p' + (i + 1),
    num: NUMS[i],
    name: NAMES[i],
    pos: POS[i],
    bat: i < 10,
  }));
}

export function freshData(): ScorebookData {
  const roster = freshRoster();
  return {
    roster,
    oppLineup: [],
    games: S.sampleSeason(roster, { games: 30, seasons: 2, year: new Date().getFullYear() }),
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
    activeId: games.some((g) => g.id === d.activeId) ? d.activeId : null,
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
    const migrated = normalize(old);
    if (!migrated.games.length) migrated.games = S.sampleSeason(migrated.roster);
    return migrated;
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
