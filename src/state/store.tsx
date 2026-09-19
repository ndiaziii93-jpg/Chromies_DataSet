import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Game, ScorebookData, Theme } from '../lib/types';
import { freshData, loadLocal, saveLocal } from './document';
import { applyTheme } from './theme';
import { clientFor, isConfigured, readSession, writeSession, type Role, type Session } from './supabase';
import { Syncer, diff, pull, type SyncState } from './sync';

interface Store {
  data: ScorebookData;
  save: (next: ScorebookData) => void;
  /** Replaces a game in place, preserving the identity fields the list owns. */
  patchGame: (id: string, g: Game) => void;
  role: Role;
  signOut: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  sync: { state: SyncState; detail?: string; pending: number };
  /** Roster name for a player id, or a readable label for an opposition batter. */
  pname: (id: string) => string;
  pnum: (id: string) => string;
  fmtDate: (t: number, short?: boolean) => string;
}

const Ctx = createContext<Store | null>(null);

export function useScorebook(): Store {
  const store = useContext(Ctx);
  if (!store) throw new Error('useScorebook must be used inside <ScorebookProvider>');
  return store;
}

export function ScorebookProvider({
  session,
  onSignOut,
  children,
}: {
  session: Session | null;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [data, setData] = useState<ScorebookData>(() => loadLocal() ?? freshData());
  const [sync, setSync] = useState<{ state: SyncState; detail?: string; pending: number }>({
    state: isConfigured ? 'idle' : 'off',
    pending: 0,
  });

  // The client library is fetched on demand, so it arrives a tick after mount.
  const [client, setClient] = useState<SupabaseClient | null>(null);
  useEffect(() => {
    if (!isConfigured) return;
    let live = true;
    void clientFor(session?.token ?? null).then((c) => {
      if (live) setClient(c);
    });
    return () => {
      live = false;
    };
  }, [session?.token]);

  const syncer = useRef<Syncer | null>(null);
  const lastPushed = useRef<ScorebookData | null>(null);

  if (!syncer.current) {
    syncer.current = new Syncer(client, (state, detail) =>
      setSync({ state, detail, pending: syncer.current?.pending ?? 0 }),
    );
  }
  useEffect(() => {
    syncer.current?.setClient(client);
  }, [client]);

  // Hydrate from the server once per session, then keep the local cache in sync.
  useEffect(() => {
    if (!client) return;
    let live = true;
    (async () => {
      try {
        const merged = await pull(client, loadLocal() ?? freshData());
        if (!live) return;
        lastPushed.current = merged;
        saveLocal(merged);
        setData(merged);
        setSync((s) => ({ ...s, state: 'idle', detail: undefined }));
      } catch (err) {
        if (!live) return;
        setSync((s) => ({
          ...s,
          state: 'error',
          detail: err instanceof Error ? err.message : String(err),
        }));
      }
    })();
    return () => {
      live = false;
    };
  }, [client]);

  const save = useCallback((next: ScorebookData) => {
    setData(next);
    saveLocal(next);
    if (isConfigured) {
      syncer.current?.enqueue(diff(lastPushed.current, next));
      lastPushed.current = next;
    }
  }, []);

  const patchGame = useCallback(
    (id: string, g: Game) => {
      setData((cur) => {
        const next = {
          ...cur,
          games: cur.games.map((x) =>
            x.id === id ? { ...g, id, opp: x.opp, date: x.date, sample: x.sample } : x,
          ),
          // A game that has ended is no longer the active one. Leaving it active
          // makes Today advertise a finished game as in progress and offer to
          // resume scoring it.
          activeId:
            cur.activeId === id && g.status !== 'in_progress' ? null : cur.activeId,
        };
        saveLocal(next);
        if (isConfigured) {
          syncer.current?.enqueue(diff(lastPushed.current, next));
          lastPushed.current = next;
        }
        return next;
      });
    },
    [],
  );

  const theme: Theme = data.settings.theme ?? 'light';
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback(
    (t: Theme) => save({ ...data, settings: { ...data.settings, theme: t } }),
    [data, save],
  );

  const pname = useCallback(
    (id: string) => {
      const p = data.roster.find((x) => x.id === id);
      return p ? p.name : id && id.startsWith('#') ? 'Opp ' + id : id || '';
    },
    [data.roster],
  );

  const pnum = useCallback(
    (id: string) => {
      const p = data.roster.find((x) => x.id === id);
      return p ? '#' + p.num : id || '';
    },
    [data.roster],
  );

  const fmtDate = useCallback(
    (t: number, short?: boolean) =>
      new Date(t)
        .toLocaleDateString(
          'en-US',
          short
            ? { month: 'short', day: 'numeric' }
            : { month: 'short', day: 'numeric', year: 'numeric' },
        )
        .toUpperCase(),
    [],
  );

  const signOut = useCallback(() => {
    writeSession(null);
    onSignOut();
  }, [onSignOut]);

  const value = useMemo<Store>(
    () => ({
      data,
      save,
      patchGame,
      role: session?.role ?? 'manager',
      signOut,
      theme,
      setTheme,
      sync,
      pname,
      pnum,
      fmtDate,
    }),
    [data, save, patchGame, session?.role, signOut, theme, setTheme, sync, pname, pnum, fmtDate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Restores a stored passcode session on load. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(() => (isConfigured ? readSession() : null));
  const signIn = useCallback((s: Session) => {
    writeSession(s);
    setSession(s);
  }, []);
  const clear = useCallback(() => setSession(null), []);
  return { session, signIn, clear };
}
