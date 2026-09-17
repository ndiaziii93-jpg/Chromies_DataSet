import type { SupabaseClient } from '@supabase/supabase-js';
import type { Game, OppBatter, Player, ScorebookData, Theme } from '../lib/types';
import { normalize, stripHistory } from './document';

const QUEUE_KEY = 'chromies-sync-queue-v1';
const DEBOUNCE_MS = 500;

type Op =
  | { t: 'game'; id: string; doc: Game }
  | { t: 'gameDelete'; id: string }
  | { t: 'roster'; rows: Player[] }
  | { t: 'opp'; teamName: string; batters: OppBatter[] }
  | { t: 'settings'; timeLimit: number; theme: Theme };

export type SyncState = 'off' | 'idle' | 'syncing' | 'queued' | 'error';

interface GameRow {
  id: string;
  doc: Game;
}
interface RosterRow {
  id: string;
  num: string | null;
  name: string;
  pos: string;
  bat: boolean;
  sort_order: number;
}

/** Everything the server holds, folded onto the local document. */
export async function pull(client: SupabaseClient, local: ScorebookData): Promise<ScorebookData> {
  const [roster, opp, settings, games] = await Promise.all([
    client.from('roster').select('*').order('sort_order'),
    client.from('opp_lineup').select('*').maybeSingle(),
    client.from('team_settings').select('id, time_limit_mins, theme').maybeSingle(),
    client.from('games').select('id, doc'),
  ]);

  const next: ScorebookData = { ...local };

  if (!roster.error && roster.data?.length) {
    next.roster = (roster.data as RosterRow[]).map((r) => ({
      id: r.id,
      num: r.num ?? '',
      name: r.name,
      pos: r.pos as Player['pos'],
      bat: r.bat,
    }));
  }
  if (!opp.error && opp.data) {
    next.oppTeam = (opp.data as { team_name: string }).team_name ?? '';
    next.oppLineup = ((opp.data as { batters: OppBatter[] }).batters ?? []) as OppBatter[];
  }
  if (!settings.error && settings.data) {
    const s = settings.data as { time_limit_mins: number; theme: Theme };
    next.settings = { timeLimit: s.time_limit_mins ?? 60, theme: s.theme ?? local.settings.theme };
  }
  if (!games.error && games.data) {
    // Last write wins per game id: the server copy replaces the local one, and
    // any game only this device knows about is kept so it can be pushed.
    const fromServer = new Map((games.data as GameRow[]).map((r) => [r.id, { ...r.doc, id: r.id }]));
    const merged = local.games.map((g) => fromServer.get(g.id) ?? g);
    const seen = new Set(merged.map((g) => g.id));
    for (const [id, doc] of fromServer) if (!seen.has(id)) merged.push({ ...doc, id });
    next.games = merged;
    next.activeId = merged.find((g) => g.id === local.activeId && g.status === 'in_progress')
      ? local.activeId
      : (merged.find((g) => g.status === 'in_progress')?.id ?? null);
  }
  return normalize(next);
}

/** Work out what actually changed between two saves, so we push rows and not the world. */
export function diff(prev: ScorebookData | null, next: ScorebookData): Op[] {
  const ops: Op[] = [];
  // Both sides are compared without the undo stack. Comparing a stripped game
  // against an unstripped one would make every game look changed on every save,
  // and a single tap would re-upload the whole season.
  const clean = stripHistory(next);
  const before = prev ? stripHistory(prev) : null;

  const prevGames = new Map((before?.games ?? []).map((g) => [g.id, g]));
  for (const g of clean.games) {
    const was = prevGames.get(g.id);
    if (!was || JSON.stringify(was) !== JSON.stringify(g)) ops.push({ t: 'game', id: g.id, doc: g });
  }
  const nextIds = new Set(clean.games.map((g) => g.id));
  for (const id of prevGames.keys()) if (!nextIds.has(id)) ops.push({ t: 'gameDelete', id });

  if (!prev || JSON.stringify(prev.roster) !== JSON.stringify(next.roster)) {
    ops.push({ t: 'roster', rows: next.roster });
  }
  if (
    !prev ||
    (prev.oppTeam ?? '') !== (next.oppTeam ?? '') ||
    JSON.stringify(prev.oppLineup) !== JSON.stringify(next.oppLineup)
  ) {
    ops.push({ t: 'opp', teamName: next.oppTeam ?? '', batters: next.oppLineup });
  }
  if (!prev || JSON.stringify(prev.settings) !== JSON.stringify(next.settings)) {
    ops.push({ t: 'settings', timeLimit: next.settings.timeLimit, theme: next.settings.theme ?? 'light' });
  }
  return ops;
}

async function apply(client: SupabaseClient, op: Op): Promise<void> {
  switch (op.t) {
    case 'game': {
      const { error } = await client.from('games').upsert({ id: op.id, doc: op.doc, updated_at: new Date().toISOString() });
      if (error) throw error;
      return;
    }
    case 'gameDelete': {
      const { error } = await client.from('games').delete().eq('id', op.id);
      if (error) throw error;
      return;
    }
    case 'roster': {
      const rows: RosterRow[] = op.rows.map((p, i) => ({
        id: p.id,
        num: p.num,
        name: p.name,
        pos: p.pos,
        bat: p.bat,
        sort_order: i,
      }));
      if (rows.length) {
        const { error } = await client.from('roster').upsert(rows);
        if (error) throw error;
      }
      const keep = rows.map((r) => r.id);
      const del = client.from('roster').delete();
      const { error } = keep.length
        ? await del.not('id', 'in', `(${keep.map((id) => `"${id}"`).join(',')})`)
        : await del.neq('id', '');
      if (error) throw error;
      return;
    }
    case 'opp': {
      const { error } = await client
        .from('opp_lineup')
        .upsert({ id: 1, team_name: op.teamName, batters: op.batters });
      if (error) throw error;
      return;
    }
    case 'settings': {
      const { error } = await client
        .from('team_settings')
        .update({ time_limit_mins: op.timeLimit, theme: op.theme })
        .eq('id', 1);
      if (error) throw error;
      return;
    }
  }
}

/**
 * A write-through cache with an offline tail: saves land in localStorage
 * immediately, and the matching row upserts are queued and flushed when the
 * network allows. Ops collapse per target, so a whole game scored offline
 * costs one upsert on reconnect rather than one per play.
 */
export class Syncer {
  private queue: Op[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private client: SupabaseClient | null,
    private onState: (s: SyncState, detail?: string) => void,
  ) {
    this.queue = readQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flush());
    }
    if (this.queue.length) this.schedule();
  }

  setClient(client: SupabaseClient | null) {
    this.client = client;
    if (client && this.queue.length) this.schedule();
  }

  enqueue(ops: Op[]) {
    if (!ops.length) return;
    for (const op of ops) {
      const key = opKey(op);
      const at = this.queue.findIndex((q) => opKey(q) === key);
      if (at >= 0) this.queue.splice(at, 1);
      this.queue.push(op);
    }
    writeQueue(this.queue);
    this.onState('queued');
    this.schedule();
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  async flush(): Promise<void> {
    if (this.running || !this.client || !this.queue.length) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    this.running = true;
    this.onState('syncing');
    try {
      while (this.queue.length) {
        const op = this.queue[0];
        await apply(this.client, op);
        this.queue.shift();
        writeQueue(this.queue);
      }
      this.onState('idle');
    } catch (err) {
      // Leave the op at the head of the queue: it retries on the next save,
      // on `online`, or on the next app load.
      this.onState('error', err instanceof Error ? err.message : String(err));
    } finally {
      this.running = false;
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}

const opKey = (op: Op): string =>
  op.t === 'game' || op.t === 'gameDelete' ? `game:${op.id}` : op.t;

function readQueue(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Op[];
  } catch {
    return [];
  }
}

function writeQueue(q: Op[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    // Queue is best-effort; an in-progress game is still safe in the document.
  }
}
