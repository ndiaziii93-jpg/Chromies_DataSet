import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RangeKey, SidePanel, SprayFilter, Tab } from '../lib/types';

/**
 * Screen state lives above the screens so it survives tab switches, the way it
 * does in the prototype: come back to Trends and it is still on the range you left.
 */
interface Nav {
  tab: Tab;
  go: (tab: Tab) => void;

  gameId: string | null;
  openGame: (id: string | null) => void;
  playerId: string | null;
  openPlayer: (id: string | null) => void;

  side: SidePanel;
  setSide: (s: SidePanel) => void;

  pdRange: RangeKey;
  setPdRange: (r: RangeKey) => void;
  trRange: RangeKey;
  setTrRange: (r: RangeKey) => void;

  trPick: string | null;
  setTrPick: (id: string | null) => void;
  trAvgPick: string | null;
  setTrAvgPick: (id: string | null) => void;
  sprayFilter: SprayFilter;
  setSprayFilter: (f: SprayFilter) => void;

  pgGame: string | null;
  setPgGame: (id: string | null) => void;
  mgTab: 'us' | 'them';
  setMgTab: (t: 'us' | 'them') => void;
}

const Ctx = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(Ctx);
  if (!nav) throw new Error('useNav must be used inside <NavProvider>');
  return nav;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('today');
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [side, setSide] = useState<SidePanel>('score');
  const [pdRange, setPdRange] = useState<RangeKey>('season');
  const [trRange, setTrRange] = useState<RangeKey>('season');
  const [trPick, setTrPick] = useState<string | null>(null);
  const [trAvgPick, setTrAvgPick] = useState<string | null>(null);
  const [sprayFilter, setSprayFilter] = useState<SprayFilter>('all');
  const [pgGame, setPgGame] = useState<string | null>(null);
  const [mgTab, setMgTab] = useState<'us' | 'them'>('us');

  const value = useMemo<Nav>(
    () => ({
      tab,
      // Leaving a tab drops its selection, so coming back lands on the list.
      go: (next) => {
        setTab(next);
        if (next !== 'games') setGameId(null);
        if (next !== 'players') setPlayerId(null);
      },
      gameId,
      openGame: (id) => {
        setGameId(id);
        if (id) setTab('games');
      },
      playerId,
      openPlayer: (id) => {
        setPlayerId(id);
        if (id) setTab('players');
      },
      side,
      setSide,
      pdRange,
      setPdRange,
      trRange,
      setTrRange,
      trPick,
      setTrPick,
      trAvgPick,
      setTrAvgPick,
      sprayFilter,
      setSprayFilter,
      pgGame,
      setPgGame,
      mgTab,
      setMgTab,
    }),
    [tab, gameId, playerId, side, pdRange, trRange, trPick, trAvgPick, sprayFilter, pgGame, mgTab],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
