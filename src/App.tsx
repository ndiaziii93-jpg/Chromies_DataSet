import * as S from './engine/stats.js';
import { css } from './lib/css';
import { BottomNav, TopBar } from './components/Chrome';
import { UpdateNotice } from './components/UpdateNotice';
import { Today } from './screens/Today';
import { Live } from './screens/Live';
import { Games } from './screens/Games';
import { Players } from './screens/Players';
import { Trends } from './screens/Trends';
import { Manage } from './screens/Manage';
import { useNav } from './state/nav';
import { seesManageTab } from './state/roles';
import { useScorebook } from './state/store';
import { liveHeadline, useActiveGame } from './state/live';

export function App() {
  const { data, role } = useScorebook();
  const nav = useNav();
  const active = useActiveGame();

  const finals = data.games.filter((g) => g.status === 'final');
  const rec = S.record(finals);

  const title = {
    today: 'Today',
    live: active ? `Live · vs ${active.opp}` : 'Live',
    games: nav.gameId ? 'Game recap' : 'Games',
    players: nav.playerId ? 'Player' : 'Players',
    trends: 'Trends',
    manage: 'Manage',
  }[nav.tab];

  const head = active ? liveHeadline(active) : null;
  const right = head
    ? `${head.us}–${head.them} · ${head.inning}`
    : finals.length
      ? `${rec.w}–${rec.l}${rec.t ? '–' + rec.t : ''}`
      : '';

  return (
    <div
      style={css(
        'min-height:100vh;max-width:1180px;margin:0 auto;background:var(--bg);display:flex;flex-direction:column',
      )}
    >
      <TopBar title={title} right={right} />

      <div style={css('flex:1;display:flex;flex-direction:column;min-height:0')}>
        {nav.tab === 'today' && <Today />}
        {nav.tab === 'live' && <Live />}
        {nav.tab === 'games' && <Games />}
        {nav.tab === 'players' && <Players />}
        {nav.tab === 'trends' && <Trends />}
        {nav.tab === 'manage' && seesManageTab(role) && <Manage />}
      </div>

      <UpdateNotice />
      <BottomNav />
    </div>
  );
}
