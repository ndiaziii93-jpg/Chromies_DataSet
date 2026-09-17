import type { BinderTab } from '../components/ui';
import type { Game, RangeKey } from './types';

const DAY = 864e5;

export const RANGES: { key: RangeKey; label: string; title: string }[] = [
  { key: '5', label: 'L5', title: 'Last 5 games' },
  { key: '10', label: 'L10', title: 'Last 10 games' },
  { key: 'weekend', label: 'WKND', title: 'Past weekend' },
  { key: 'season', label: 'SZN', title: 'This season' },
  { key: 'last', label: 'LAST', title: 'Last season' },
  { key: 'all', label: 'ALL', title: 'All time' },
];

export const RANGE_TABS: BinderTab[] = RANGES.map((r) => ({
  key: r.key,
  label: r.label,
  title: r.title,
}));

export const rangeTitle = (key: RangeKey): string =>
  (RANGES.find((r) => r.key === key)?.title ?? '').toUpperCase();

/** Friday through Sunday of the weekend just played. */
function lastWeekend(now: number): [number, number] {
  const d = new Date(now);
  const back = d.getDay() === 0 ? 0 : d.getDay();
  const sun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  const fri = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() - 2);
  return [fri.getTime(), sun.getTime() + DAY];
}

/** Games in the selected range, oldest first — the order the charts read in. */
export function applyRange(list: Game[], range: RangeKey, now = Date.now()): Game[] {
  const yr = new Date(now).getFullYear();
  const weekend = lastWeekend(now);
  const inRange = (g: Game) =>
    range === 'season' ? new Date(g.date).getFullYear() === yr
    : range === 'last' ? new Date(g.date).getFullYear() === yr - 1
    : range === 'weekend' ? g.date >= weekend[0] && g.date < weekend[1]
    : true;

  const counted = range === '5' || range === '10';
  const chron = [...list].sort((a, b) => a.date - b.date).filter((g) => (counted ? true : inRange(g)));
  if (range === '5') return chron.slice(-5);
  if (range === '10') return chron.slice(-10);
  return chron;
}
